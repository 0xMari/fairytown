import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();

export class FairyControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.isLocked = false;
    this.baseSpeed = 12;
    this.boostMultiplier = 2.15;
    this.maxHeight = 20;
    this.lookSensitivity = 0.0022;
    this.pitch = 0;
    this.yaw = 0;
    this.keys = new Set();

    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handlePointerLockChange = this.handlePointerLockChange.bind(this);
    this.handleKeyDown = (event) => this.keys.add(event.code);
    this.handleKeyUp = (event) => this.keys.delete(event.code);
    this.handleClick = () => {
      if (!this.isLocked) {
        this.domElement.requestPointerLock();
      }
    };

    document.addEventListener("mousemove", this.handleMouseMove);
    document.addEventListener("pointerlockchange", this.handlePointerLockChange);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    this.domElement.addEventListener("click", this.handleClick);
  }

  handlePointerLockChange() {
    this.isLocked = document.pointerLockElement === this.domElement;
  }

  handleMouseMove(event) {
    if (!this.isLocked) {
      return;
    }

    this.yaw -= event.movementX * this.lookSensitivity;
    this.pitch -= event.movementY * this.lookSensitivity;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2.2, Math.PI / 2.2);
  }

  update(delta) {
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    const move = new THREE.Vector3();

    this.camera.getWorldDirection(FORWARD);
    FORWARD.normalize();
    RIGHT.crossVectors(FORWARD, UP).normalize();

    if (this.keys.has("KeyW")) {
      move.add(FORWARD);
    }

    if (this.keys.has("KeyS")) {
      move.sub(FORWARD);
    }

    if (this.keys.has("KeyD")) {
      move.add(RIGHT);
    }

    if (this.keys.has("KeyA")) {
      move.sub(RIGHT);
    }

    if (this.keys.has("Space")) {
      move.y += 1;
    }

    if (this.keys.has("KeyC")) {
      move.y -= 1;
    }

    if (move.lengthSq() > 0) {
      move.normalize();
    }

    const speed =
      this.baseSpeed *
      (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? this.boostMultiplier : 1);

    this.camera.position.addScaledVector(move, speed * delta);
    this.camera.position.y = Math.min(this.maxHeight, this.camera.position.y);
  }
}
