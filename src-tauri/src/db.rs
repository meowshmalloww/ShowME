use crate::{
    error::{CommandError, CommandResult},
    models::{
        AppSettings, Confidence, GenerateLessonRequest, LessonPlan, LessonReceipt, ProviderId,
        StoredLesson,
    },
};
use chrono::Utc;
use rusqlite::{Connection, OptionalExtension, params};
use serde_json::{Value, json};
use std::path::Path;

pub fn initialize(path: &Path) -> CommandResult<()> {
    let connection = open(path)?;
    connection
        .execute_batch(
            "
            PRAGMA journal_mode = WAL;
            PRAGMA foreign_keys = ON;
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS lessons (
                id TEXT PRIMARY KEY,
                created_at TEXT NOT NULL,
                title TEXT NOT NULL,
                concept TEXT NOT NULL,
                question TEXT NOT NULL,
                provider TEXT NOT NULL,
                model TEXT NOT NULL,
                confidence TEXT NOT NULL,
                source_description TEXT NOT NULL,
                plan_json TEXT NOT NULL,
                helpful INTEGER NULL
            );
            CREATE INDEX IF NOT EXISTS idx_lessons_created_at ON lessons(created_at DESC);
            CREATE TABLE IF NOT EXISTS preference_feedback (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            ",
        )
        .map_err(|error| CommandError::internal("initialize database", error))?;
    Ok(())
}

fn open(path: &Path) -> CommandResult<Connection> {
    Connection::open(path).map_err(|error| CommandError::internal("open database", error))
}

pub fn get_settings(path: &Path) -> CommandResult<AppSettings> {
    let connection = open(path)?;
    let value: Option<String> = connection
        .query_row("SELECT value FROM settings WHERE id = 1", [], |row| {
            row.get(0)
        })
        .optional()
        .map_err(|error| CommandError::internal("read settings", error))?;
    match value {
        Some(value) => serde_json::from_str(&value)
            .map_err(|error| CommandError::internal("decode settings", error)),
        None => Ok(AppSettings::default()),
    }
}

pub fn save_settings(path: &Path, settings: &AppSettings) -> CommandResult<()> {
    let value = serde_json::to_string(settings)
        .map_err(|error| CommandError::internal("encode settings", error))?;
    open(path)?
        .execute(
            "INSERT INTO settings (id, value, updated_at) VALUES (1, ?1, ?2)
             ON CONFLICT(id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
            params![value, Utc::now().to_rfc3339()],
        )
        .map_err(|error| CommandError::internal("save settings", error))?;
    Ok(())
}

pub fn save_lesson(
    path: &Path,
    request: &GenerateLessonRequest,
    plan: &LessonPlan,
) -> CommandResult<()> {
    let plan_json = serde_json::to_string(plan)
        .map_err(|error| CommandError::internal("encode lesson", error))?;
    open(path)?
        .execute(
            "INSERT INTO lessons
                (id, created_at, title, concept, question, provider, model, confidence, source_description, plan_json)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                plan.id,
                Utc::now().to_rfc3339(),
                plan.title,
                plan.concept,
                request.question,
                request.provider.as_str(),
                request.model,
                confidence_string(plan.confidence),
                plan.source_description,
                plan_json,
            ],
        )
        .map_err(|error| CommandError::internal("save lesson", error))?;
    Ok(())
}

pub fn list_lessons(path: &Path, limit: usize) -> CommandResult<Vec<LessonReceipt>> {
    let connection = open(path)?;
    let mut statement = connection
        .prepare(
            "SELECT id, created_at, title, concept, question, provider, model, confidence,
                    source_description, helpful, plan_json
             FROM lessons ORDER BY created_at DESC LIMIT ?1",
        )
        .map_err(|error| CommandError::internal("prepare lesson list", error))?;
    let rows = statement
        .query_map([limit as i64], receipt_from_row)
        .map_err(|error| CommandError::internal("query lesson list", error))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|error| CommandError::internal("read lesson list", error))
}

pub fn get_lesson(path: &Path, id: &str) -> CommandResult<StoredLesson> {
    let connection = open(path)?;
    connection
        .query_row(
            "SELECT id, created_at, title, concept, question, provider, model, confidence,
                    source_description, helpful, plan_json
             FROM lessons WHERE id = ?1",
            [id],
            |row| {
                let receipt = receipt_from_row(row)?;
                let plan_json: String = row.get(10)?;
                let plan = serde_json::from_str(&plan_json).map_err(|error| {
                    rusqlite::Error::FromSqlConversionFailure(
                        plan_json.len(),
                        rusqlite::types::Type::Text,
                        Box::new(error),
                    )
                })?;
                Ok(StoredLesson { receipt, plan })
            },
        )
        .optional()
        .map_err(|error| CommandError::internal("read lesson", error))?
        .ok_or_else(|| CommandError::new("LESSON_NOT_FOUND", "That lesson is no longer stored."))
}

fn receipt_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<LessonReceipt> {
    let provider: String = row.get(5)?;
    let confidence: String = row.get(7)?;
    let helpful: Option<i64> = row.get(9)?;
    let plan_json: String = row.get(10)?;
    let citation_count = serde_json::from_str::<Value>(&plan_json)
        .ok()
        .and_then(|plan| {
            plan.get("citations")
                .and_then(Value::as_array)
                .map(Vec::len)
        })
        .unwrap_or(0);
    Ok(LessonReceipt {
        id: row.get(0)?,
        created_at: row.get(1)?,
        title: row.get(2)?,
        concept: row.get(3)?,
        question: row.get(4)?,
        provider: parse_provider(&provider),
        model: row.get(6)?,
        confidence: parse_confidence(&confidence),
        citation_count,
        source_description: row.get(8)?,
        helpful: helpful.map(|value| value != 0),
    })
}

pub fn delete_lesson(path: &Path, id: &str) -> CommandResult<()> {
    open(path)?
        .execute("DELETE FROM lessons WHERE id = ?1", [id])
        .map_err(|error| CommandError::internal("delete lesson", error))?;
    Ok(())
}

pub fn delete_all_memory(path: &Path) -> CommandResult<()> {
    let mut connection = open(path)?;
    let transaction = connection
        .transaction()
        .map_err(|error| CommandError::internal("begin memory deletion", error))?;
    transaction
        .execute("DELETE FROM lessons", [])
        .and_then(|_| transaction.execute("DELETE FROM preference_feedback", []))
        .map_err(|error| CommandError::internal("delete memory", error))?;
    transaction
        .commit()
        .map_err(|error| CommandError::internal("commit memory deletion", error))?;
    Ok(())
}

pub fn set_feedback(path: &Path, id: &str, helpful: bool) -> CommandResult<()> {
    let changed = open(path)?
        .execute(
            "UPDATE lessons SET helpful = ?1 WHERE id = ?2",
            params![i64::from(helpful), id],
        )
        .map_err(|error| CommandError::internal("save feedback", error))?;
    if changed == 0 {
        return Err(CommandError::new(
            "LESSON_NOT_FOUND",
            "That lesson is no longer stored.",
        ));
    }
    Ok(())
}

pub fn export_memory(path: &Path) -> CommandResult<String> {
    let settings = get_settings(path)?;
    let lessons = list_lessons(path, 10_000)?
        .into_iter()
        .filter_map(|receipt| get_lesson(path, &receipt.id).ok())
        .collect::<Vec<_>>();
    serde_json::to_string_pretty(&json!({
        "schemaVersion": 1,
        "exportedAt": Utc::now().to_rfc3339(),
        "settings": settings,
        "lessons": lessons,
    }))
    .map_err(|error| CommandError::internal("export memory", error))
}

fn confidence_string(value: Confidence) -> &'static str {
    match value {
        Confidence::VerifiedModule => "verified-module",
        Confidence::SourceGrounded => "source-grounded",
        Confidence::Exploratory => "exploratory",
    }
}

fn parse_confidence(value: &str) -> Confidence {
    match value {
        "verified-module" => Confidence::VerifiedModule,
        "source-grounded" => Confidence::SourceGrounded,
        _ => Confidence::Exploratory,
    }
}

fn parse_provider(value: &str) -> ProviderId {
    match value {
        "nvidia" => ProviderId::Nvidia,
        "groq" => ProviderId::Groq,
        "cerebras" => ProviderId::Cerebras,
        "openrouter" => ProviderId::Openrouter,
        _ => ProviderId::Openai,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn settings_round_trip() {
        let directory = tempdir().unwrap();
        let path = directory.path().join("showme.db");
        initialize(&path).unwrap();
        let settings = AppSettings {
            pet_name: "Pixel".into(),
            ..AppSettings::default()
        };
        save_settings(&path, &settings).unwrap();
        assert_eq!(get_settings(&path).unwrap().pet_name, "Pixel");
    }

    #[test]
    fn deleting_all_memory_preserves_settings() {
        let directory = tempdir().unwrap();
        let path = directory.path().join("showme.db");
        initialize(&path).unwrap();
        let settings = AppSettings::default();
        save_settings(&path, &settings).unwrap();
        delete_all_memory(&path).unwrap();
        assert_eq!(get_settings(&path).unwrap().pet_name, "ShowME");
    }
}
