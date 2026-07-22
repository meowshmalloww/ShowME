import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verify import verify


class VerifyTests(unittest.TestCase):
    def test_orbit_constants(self):
        result = verify(
            {
                "kind": "orbit",
                "gravitationalParameter": 3.986004418e14,
                "planetRadius": 6_371_000,
                "initialAltitude": 400_000,
                "initialVelocity": 7_670,
            }
        )
        self.assertTrue(result["verified"])
        self.assertTrue(math.isclose(result["details"]["circularVelocity"], 7672.6, rel_tol=0.01))

    def test_projectile_is_finite(self):
        result = verify(
            {
                "kind": "projectile",
                "gravity": 9.81,
                "speed": 20,
                "angleDegrees": 45,
                "initialHeight": 0,
                "dragCoefficient": 0,
            }
        )
        self.assertTrue(result["verified"])
        self.assertGreater(result["details"]["estimatedRange"], 40)

    def test_projectile_drag_changes_verified_range(self):
        base = {
            "kind": "projectile",
            "gravity": 9.81,
            "speed": 30,
            "angleDegrees": 42,
            "initialHeight": 0,
        }
        vacuum = verify({**base, "dragCoefficient": 0})
        resisted = verify({**base, "dragCoefficient": 0.02})
        self.assertTrue(resisted["verified"])
        self.assertLess(
            resisted["details"]["estimatedRange"],
            vacuum["details"]["estimatedRange"],
        )

    def test_custom_rejects_missing_entity(self):
        result = verify(
            {
                "kind": "custom",
                "entities": [],
                "motions": [{"entityId": "missing"}],
            }
        )
        self.assertFalse(result["verified"])

    def test_motion_scene_accepts_constrained_story_beats(self):
        result = verify(
            {
                "kind": "motion-scene",
                "durationSeconds": 8,
                "title": "Cause and effect",
                "layout": "cause-effect",
                "beats": [
                    {
                        "id": "cause",
                        "marker": "Cause",
                        "heading": "A condition changes",
                        "caption": "The first event creates pressure.",
                        "accent": "amber",
                    },
                    {
                        "id": "effect",
                        "marker": "Effect",
                        "heading": "An outcome follows",
                        "caption": "The consequence completes the chain.",
                        "accent": "mint",
                    },
                ],
            }
        )
        self.assertTrue(result["verified"])
        self.assertEqual(result["details"]["beats"], 2)


if __name__ == "__main__":
    unittest.main()
