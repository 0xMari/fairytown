import "./LoadingScreen.css";

const LOADING_MESSAGES = [
  { threshold: 90, text: "Preparing your wings..." },
  { threshold: 75, text: "Waking the lanterns..." },
  { threshold: 60, text: "Painting the sky..." },
  { threshold: 45, text: "Gathering morning dew..." },
  { threshold: 30, text: "Polishing crystal fields..." },
  { threshold: 15, text: "Growing the forest..." },
  { threshold: 0, text: "Summoning mushrooms..." }
];

function clampPercentage(value) {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export class LoadingScreen {
  constructor({
    renderer,
    onEnter = null,
    root = document.querySelector("#entry-screen")
  } = {}) {
    if (!root) {
      throw new Error("LoadingScreen requires an #entry-screen root element.");
    }

    this.renderer = renderer;
    this.onEnter = onEnter;
    this.screen = root;
    this.entered = false;
    this.isReady = false;
    this.percentage = 0;

    this.message = root.querySelector("#entry-message");
    this.status = root.querySelector("#entry-status");
    this.progress = root.querySelector("#entry-progress");
    this.progressFill = root.querySelector("#entry-progress-fill");
    this.controls = root.querySelector(".entry-screen__controls");
    this.enterButton = root.querySelector("#enter-world-button");
    this.crosshair = document.querySelector("#crosshair");

    this.handleEnter = this.handleEnter.bind(this);
    this.enterButton?.addEventListener("click", this.handleEnter);

    this.setReady(false);
  }

  get hasEntered() {
    return this.entered;
  }

  getMessage(percentage) {
    if (percentage >= 100) {
      return "Your wings are ready.";
    }

    return LOADING_MESSAGES.find(({ threshold }) => percentage >= threshold)?.text
      ?? LOADING_MESSAGES.at(-1).text;
  }

  setProgress(loaded, total) {
    const safeTotal = Math.max(total, 1);
    const percentage = Math.max(
      this.percentage,
      clampPercentage((loaded / safeTotal) * 100)
    );

    this.updateProgressDisplay(percentage);

    if (this.message) {
      this.message.textContent = this.getMessage(percentage);
    }
  }

  setReady(isReady) {
    this.isReady = isReady;

    if (!isReady) {
      this.percentage = 0;
    }

    if (this.enterButton) {
      this.enterButton.disabled = !isReady;
      this.enterButton.hidden = !isReady;
      this.enterButton.classList.toggle("is-visible", isReady);
    }

    this.controls?.classList.toggle("is-visible", isReady);
    this.controls?.setAttribute("aria-hidden", String(!isReady));

    if (this.message) {
      this.message.textContent = isReady
        ? "You are a fairy."
        : "Summoning mushrooms...";
    }

    this.updateProgressDisplay(isReady ? 100 : 0);
  }

  updateProgressDisplay(percentage) {
    const safePercentage = clampPercentage(percentage);
    this.percentage = safePercentage;

    if (this.status) {
      this.status.textContent = `${safePercentage}%`;
    }

    this.progress?.setAttribute("aria-valuenow", String(safePercentage));

    if (this.progressFill) {
      this.progressFill.style.transform = `scaleX(${safePercentage / 100})`;
    }
  }

  handleEnter() {
    if (!this.isReady || this.entered) {
      return;
    }

    this.entered = true;
    this.screen.classList.add("is-hidden");
    this.crosshair?.classList.remove("is-hidden");
    this.renderer?.domElement.requestPointerLock?.();
    this.onEnter?.();
  }

  destroy() {
    this.enterButton?.removeEventListener("click", this.handleEnter);
  }
}
