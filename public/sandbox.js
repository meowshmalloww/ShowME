(() => {
  const canvas = document.getElementById("motion");
  const context = canvas.getContext("2d", { alpha: true });
  let spec = null;
  let startedAt = performance.now();
  let running = true;
  let animationFrame = 0;

  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(canvas.clientWidth * ratio));
    canvas.height = Math.max(1, Math.floor(canvas.clientHeight * ratio));
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const safeColor = (value) =>
    typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value) ? value : "#7cf4d6";

  const motionFor = (entityId) =>
    (spec?.motions || []).filter((motion) => motion.entityId === entityId);

  const drawArrow = (x, y, width, height, color) => {
    context.strokeStyle = color;
    context.fillStyle = color;
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + width, y + height);
    context.stroke();
    const angle = Math.atan2(height, width);
    context.beginPath();
    context.moveTo(x + width, y + height);
    context.lineTo(
      x + width - 12 * Math.cos(angle - Math.PI / 6),
      y + height - 12 * Math.sin(angle - Math.PI / 6),
    );
    context.lineTo(
      x + width - 12 * Math.cos(angle + Math.PI / 6),
      y + height - 12 * Math.sin(angle + Math.PI / 6),
    );
    context.closePath();
    context.fill();
  };

  const frame = (now) => {
    resize();
    context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    if (spec) {
      const elapsed = Math.min((now - startedAt) / 1000, spec.durationSeconds || 10);
      const widthScale = canvas.clientWidth / 1000;
      const heightScale = canvas.clientHeight / 1000;
      for (const entity of spec.entities || []) {
        let x = entity.x;
        let y = entity.y;
        let rotation = 0;
        let scale = 1;
        for (const motion of motionFor(entity.id)) {
          const wave = Math.sin(elapsed * motion.frequency * Math.PI * 2 + motion.phase);
          if (motion.kind === "oscillate-x") x += wave * motion.amplitude;
          if (motion.kind === "oscillate-y") y += wave * motion.amplitude;
          if (motion.kind === "orbit") {
            x +=
              Math.cos(elapsed * motion.frequency * Math.PI * 2 + motion.phase) * motion.amplitude;
            y +=
              Math.sin(elapsed * motion.frequency * Math.PI * 2 + motion.phase) * motion.amplitude;
          }
          if (motion.kind === "rotate") rotation += wave * motion.amplitude * (Math.PI / 180);
          if (motion.kind === "pulse") scale = Math.max(0.2, 1 + wave * (motion.amplitude / 1000));
        }
        const px = x * widthScale;
        const py = y * heightScale;
        const entityWidth = entity.width * widthScale;
        const entityHeight = entity.height * heightScale;
        const color = safeColor(entity.color);
        context.save();
        context.translate(px, py);
        context.rotate(rotation);
        context.scale(scale, scale);
        context.translate(-px, -py);
        context.globalAlpha = 0.94;
        context.fillStyle = color;
        context.strokeStyle = color;
        if (entity.shape === "circle") {
          context.beginPath();
          context.arc(px, py, Math.max(2, entityWidth / 2), 0, Math.PI * 2);
          context.fill();
        } else if (entity.shape === "rect") {
          context.beginPath();
          context.roundRect(
            px - entityWidth / 2,
            py - entityHeight / 2,
            entityWidth,
            entityHeight,
            10,
          );
          context.fill();
        } else {
          drawArrow(px, py, entityWidth, entityHeight, color);
        }
        if (entity.label) {
          context.fillStyle = "#eaf5ff";
          context.font = "600 13px system-ui";
          context.textAlign = "center";
          context.fillText(String(entity.label).slice(0, 120), px, py + entityHeight / 2 + 20);
        }
        context.restore();
      }
      if (elapsed >= spec.durationSeconds) running = false;
    }
    if (running) animationFrame = requestAnimationFrame(frame);
  };

  window.addEventListener("message", (event) => {
    const candidate = event.data;
    if (candidate?.type !== "SHOWME_MOTION_SPEC") return;
    if (candidate.spec?.kind !== "custom") return;
    if ((candidate.spec.entities || []).length > 40 || (candidate.spec.motions || []).length > 40)
      return;
    spec = candidate.spec;
    startedAt = performance.now();
    running = candidate.reducedMotion !== true;
    cancelAnimationFrame(animationFrame);
    animationFrame = requestAnimationFrame(frame);
  });

  window.addEventListener("resize", resize);
  resize();
  animationFrame = requestAnimationFrame(frame);
})();
