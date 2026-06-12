import "./MobileUnsupported.css";

const MOBILE_USER_AGENT =
  /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

function isIPadOS() {
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function isMobileDevice() {
  const userAgentDataSaysMobile = navigator.userAgentData?.mobile === true;
  const userAgentSaysMobile = MOBILE_USER_AGENT.test(navigator.userAgent);
  const compactTouchDevice = window.matchMedia(
    "(max-width: 900px) and (pointer: coarse)"
  ).matches;

  return (
    userAgentDataSaysMobile
    || userAgentSaysMobile
    || isIPadOS()
    || compactTouchDevice
  );
}

export class MobileUnsupported {
  constructor({
    root = document.querySelector("#mobile-unsupported")
  } = {}) {
    if (!root) {
      throw new Error(
        "MobileUnsupported requires a #mobile-unsupported root element."
      );
    }

    this.root = root;
  }

  show() {
    this.root.hidden = false;
    document.querySelector("#entry-screen")?.setAttribute("hidden", "");
    document.querySelector(".hud")?.setAttribute("hidden", "");
    document.querySelector("#crosshair")?.setAttribute("hidden", "");
    document.body.classList.add("is-mobile-unsupported");
  }
}
