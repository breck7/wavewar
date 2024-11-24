class Drone {
  constructor(globe) {
    this.globe = globe
    this.speed = 0.01 + Math.random() * 0.02
    this.mesh = this.createDroneMesh()
    this.position = this.getRandomPosition()
    this.target = this.getRandomPosition()
    this.mesh.position.copy(this.position)
    this.isExploding = false
    this.explosionProgress = 0
    this.explosionDuration = 1000 // 1 second explosion animation

    globe.scene.add(this.mesh)
  }

  createDroneMesh() {
    // Create drone body
    const bodyGeometry = new THREE.BoxGeometry(0.03, 0.01, 0.02)
    const bodyMaterial = new THREE.MeshPhongMaterial({
      color: 0xff4444,
      emissive: 0x441111,
      shininess: 30,
    })
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)

    // Create drone wings
    const wingGeometry = new THREE.BoxGeometry(0.02, 0.002, 0.02)
    const wingMaterial = new THREE.MeshPhongMaterial({
      color: 0x666666,
      shininess: 20,
    })

    const leftWing = new THREE.Mesh(wingGeometry, wingMaterial)
    leftWing.position.x = -0.02
    const rightWing = new THREE.Mesh(wingGeometry, wingMaterial)
    rightWing.position.x = 0.02

    // Create group to hold all drone parts
    const droneGroup = new THREE.Group()
    droneGroup.add(body)
    droneGroup.add(leftWing)
    droneGroup.add(rightWing)

    return droneGroup
  }

  getRandomPosition() {
    const radius = 0.8 // Slightly larger than Earth's radius
    const theta = Math.random() * Math.PI * 2
    const phi = Math.random() * Math.PI

    return new THREE.Vector3(
      radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.sin(phi) * Math.sin(theta),
      radius * Math.cos(phi),
    )
  }

  update(delta) {
    if (this.isExploding) {
      this.updateExplosion(delta)
      return
    }

    // Move towards target
    const direction = this.target.clone().sub(this.position).normalize()
    this.position.add(direction.multiplyScalar(this.speed * delta))
    this.mesh.position.copy(this.position)

    // Look in the direction of movement
    this.mesh.lookAt(this.target)

    // If close to target, get new target
    if (this.position.distanceTo(this.target) < 0.1) {
      this.target = this.getRandomPosition()
    }

    // Check for wave collisions
    this.checkWaveCollisions()
  }

  checkWaveCollisions() {
    // Check EMP waves
    this.globe.activeEMPWaves.forEach((wave) => {
      const waveRadius = wave.mesh.scale.x * 0.5
      const distanceFromCenter = this.position.length()
      if (
        Math.abs(distanceFromCenter - waveRadius) < 0.05 &&
        !this.isExploding
      ) {
        this.startExplosion()
      }
    })

    // Check Sound waves
    this.globe.activeSoundWaves.forEach((wave) => {
      const waveRadius = wave.mesh.scale.x * 0.5
      const distanceFromCenter = this.position.length()
      if (
        Math.abs(distanceFromCenter - waveRadius) < 0.05 &&
        !this.isExploding
      ) {
        this.startExplosion()
      }
    })
  }

  startExplosion() {
    this.isExploding = true
    this.explosionStartTime = Date.now()

    // Create explosion particles
    const particleCount = 20
    const particles = new THREE.Group()

    for (let i = 0; i < particleCount; i++) {
      const geometry = new THREE.BoxGeometry(0.01, 0.01, 0.01)
      const material = new THREE.MeshPhongMaterial({
        color: Math.random() > 0.5 ? 0xff4444 : 0xff7700,
        emissive: 0x441111,
      })
      const particle = new THREE.Mesh(geometry, material)

      // Random direction for particle
      particle.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
      )

      particles.add(particle)
    }

    this.globe.scene.add(particles)
    this.explosionParticles = particles
  }

  updateExplosion(delta) {
    const elapsed = Date.now() - this.explosionStartTime
    const progress = elapsed / this.explosionDuration

    if (progress >= 1) {
      // Remove drone and particles
      this.globe.scene.remove(this.mesh)
      this.globe.scene.remove(this.explosionParticles)
      this.globe.drones = this.globe.drones.filter((d) => d !== this)
      return
    }

    // Update particle positions and scale
    this.explosionParticles.children.forEach((particle) => {
      particle.position.add(particle.velocity)
      particle.scale.multiplyScalar(0.95)
    })

    // Fade out original drone
    this.mesh.scale.multiplyScalar(0.9)
  }
}

class Globe {
  constructor() {
    this.renderer = null
    this.scene = null
    this.camera = null
    this.earth = null
    this.spikes = []
    this.animationId = null
    this.stars = null

    // Camera control properties
    this.isDragging = false
    this.previousMousePosition = {
      x: 0,
      y: 0,
    }

    // Camera orbit properties
    this.cameraDistance = 1
    this.cameraRotation = {
      x: Math.PI * 0.1, // slightly above equator
      y: Math.PI * 0.6, // west of prime meridian
    }

    // Zoom properties
    this.minZoom = 0.1
    this.maxZoom = 10
    this.currentZoom = 0.2
    this.zoomSpeed = 0.02

    this.activeEMPWaves = []
    this.empCooldown = false
    this.empCooldownDuration = 20 // 300ms cooldown

    // Add sound wave properties
    this.activeSoundWaves = []
    this.soundCooldown = false
    this.soundCooldownDuration = 20 // 300ms cooldown like EMP

    this.drones = []
    this.lastDroneSpawn = 0
    this.droneSpawnInterval = 2000 // Spawn a new drone every 2 seconds
    this.maxDrones = 10 // Maximum number of drones allowed
  }

  createControlPanel() {
    const controlPanel = document.createElement("div")
    controlPanel.style.position = "fixed"
    controlPanel.style.bottom = "20px"
    controlPanel.style.right = "20px"
    controlPanel.style.padding = "20px"
    controlPanel.style.backgroundColor = "rgba(0, 0, 0, 0.8)"
    controlPanel.style.borderRadius = "15px"
    controlPanel.style.zIndex = "1000"
    controlPanel.style.display = "flex"
    controlPanel.style.flexDirection = "column"
    controlPanel.style.alignItems = "center"
    controlPanel.style.gap = "10px"

    // Controller shape background
    const controllerShape = document.createElement("div")
    controllerShape.style.position = "absolute"
    controllerShape.style.top = "0"
    controllerShape.style.left = "0"
    controllerShape.style.right = "0"
    controllerShape.style.bottom = "0"
    controllerShape.style.borderRadius = "15px"
    controllerShape.style.border = "2px solid rgba(255, 255, 255, 0.2)"
    controllerShape.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.5)"
    controlPanel.appendChild(controllerShape)

    const buttonContainer = document.createElement("div")
    buttonContainer.style.display = "flex"
    buttonContainer.style.gap = "15px"
    buttonContainer.style.position = "relative"
    buttonContainer.style.zIndex = "1"

    const createButton = (text, color, action) => {
      const button = document.createElement("button")
      button.textContent = text
      button.style.width = "40px"
      button.style.height = "40px"
      button.style.backgroundColor = color
      button.style.color = "white"
      button.style.border = "none"
      button.style.borderRadius = "50%"
      button.style.cursor = "pointer"
      button.style.fontSize = "16px"
      button.style.fontWeight = "bold"
      button.style.boxShadow = "0 0 5px rgba(0, 0, 0, 0.3)"
      button.style.transition = "all 0.2s ease"

      button.addEventListener("mouseenter", () => {
        if (!this[action.toLowerCase() + "Cooldown"]) {
          button.style.transform = "scale(1.1)"
          button.style.boxShadow = "0 0 10px " + color
        }
      })
      button.addEventListener("mouseleave", () => {
        button.style.transform = "scale(1)"
        button.style.boxShadow = "0 0 5px rgba(0, 0, 0, 0.3)"
      })

      button.addEventListener("click", () => this.handleAction(action))
      return button
    }

    const empButton = createButton("E", "#4CAF50", "EMP")
    const soundButton = createButton("S", "#2196F3", "SOUND")

    buttonContainer.appendChild(empButton)
    buttonContainer.appendChild(soundButton)
    controlPanel.appendChild(buttonContainer)

    // Add keyboard shortcut hint
    const shortcutHint = document.createElement("div")
    shortcutHint.textContent = "Press E or S"
    shortcutHint.style.color = "rgba(255, 255, 255, 0.5)"
    shortcutHint.style.fontSize = "12px"
    shortcutHint.style.marginTop = "5px"
    controlPanel.appendChild(shortcutHint)

    document.body.appendChild(controlPanel)

    // Add keyboard listeners
    document.addEventListener("keydown", (e) => {
      if (e.key.toLowerCase() === "e") {
        this.handleAction("EMP")
      } else if (e.key.toLowerCase() === "s") {
        this.handleAction("SOUND")
      }
    })
  }

  handleAction(action) {
    const cooldownProperty = action.toLowerCase() + "Cooldown"
    if (!this[cooldownProperty]) {
      if (action === "EMP") {
        this.triggerEMP()
      } else {
        this.triggerSound()
      }

      // Handle cooldown
      this[cooldownProperty] = true
      setTimeout(() => {
        this[cooldownProperty] = false
      }, this.soundCooldownDuration)
    }
  }

  triggerSound() {
    const soundGeometry = new THREE.SphereGeometry(0.5, 32, 32)
    const soundMaterial = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x2196f3) },
        maxRadius: { value: 5.0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float maxRadius;
        varying vec3 vNormal;

        void main() {
          float intensity = 1.0 - (time * time);
          float edge = 0.1;
          float rim = smoothstep(0.5 - edge, 0.5 + edge, dot(vNormal, vec3(0.0, 0.0, 1.0)));
          float wave = sin(time * 20.0) * 0.5 + 0.5;
          gl_FragColor = vec4(color, intensity * (1.0 - rim) * wave * 0.7);
        }
      `,
    })

    const soundWave = new THREE.Mesh(soundGeometry, soundMaterial)
    this.scene.add(soundWave)

    const wave = {
      mesh: soundWave,
      geometry: soundGeometry,
      material: soundMaterial,
      startTime: Date.now(),
      duration: 2000,
      maxScale: 8,
    }

    this.activeSoundWaves.push(wave)

    if (this.activeSoundWaves.length === 1) {
      this.animateSoundWaves()
    }
  }

  animateSoundWaves() {
    for (let i = this.activeSoundWaves.length - 1; i >= 0; i--) {
      const wave = this.activeSoundWaves[i]
      const elapsed = Date.now() - wave.startTime
      const progress = elapsed / wave.duration

      if (progress >= 1) {
        this.scene.remove(wave.mesh)
        wave.geometry.dispose()
        wave.material.dispose()
        this.activeSoundWaves.splice(i, 1)
      } else {
        const scale = 1 + (wave.maxScale - 1) * progress
        wave.mesh.scale.set(scale, scale, scale)
        wave.material.uniforms.time.value = progress
      }
    }

    if (this.activeSoundWaves.length > 0) {
      requestAnimationFrame(() => this.animateSoundWaves())
    }
  }

  triggerEMP() {
    // Create a sphere geometry for the EMP wave
    const empGeometry = new THREE.SphereGeometry(0.5, 32, 32)
    const empMaterial = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        time: { value: 0 },
        color: { value: new THREE.Color(0x00ff00) },
        maxRadius: { value: 5.0 },
      },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 color;
        uniform float maxRadius;
        varying vec3 vNormal;

        void main() {
          float intensity = 1.0 - (time * time); // Inverse square law decay
          float edge = 0.05;
          float rim = smoothstep(0.5 - edge, 0.5 + edge, dot(vNormal, vec3(0.0, 0.0, 1.0)));
          gl_FragColor = vec4(color, intensity * (1.0 - rim) * 0.5);
        }
      `,
    })

    const empWave = new THREE.Mesh(empGeometry, empMaterial)
    this.scene.add(empWave)

    // Create wave object to track this specific wave
    const wave = {
      mesh: empWave,
      geometry: empGeometry,
      material: empMaterial,
      startTime: Date.now(),
      duration: 2000, // 2 seconds
      maxScale: 10,
    }

    // Add to active waves array
    this.activeEMPWaves.push(wave)

    // Modify the animate method to handle multiple waves
    if (this.activeEMPWaves.length === 1) {
      // Only start if this is the first wave
      this.animateEMPWaves()
    }
  }

  animateEMPWaves() {
    // Process all active waves
    for (let i = this.activeEMPWaves.length - 1; i >= 0; i--) {
      const wave = this.activeEMPWaves[i]
      const elapsed = Date.now() - wave.startTime
      const progress = elapsed / wave.duration

      if (progress >= 1) {
        // Remove completed wave
        this.scene.remove(wave.mesh)
        wave.geometry.dispose()
        wave.material.dispose()
        this.activeEMPWaves.splice(i, 1)
      } else {
        // Update wave
        const scale = 1 + (wave.maxScale - 1) * progress
        wave.mesh.scale.set(scale, scale, scale)
        wave.material.uniforms.time.value = progress
      }
    }

    // Continue animation if there are still active waves
    if (this.activeEMPWaves.length > 0) {
      requestAnimationFrame(() => this.animateEMPWaves())
    }
  }

  updateCameraPosition() {
    // Convert spherical coordinates to Cartesian
    const phi = this.cameraRotation.x // vertical angle
    const theta = this.cameraRotation.y // horizontal angle
    const radius = this.cameraDistance / this.currentZoom

    this.camera.position.x = radius * Math.cos(phi) * Math.cos(theta)
    this.camera.position.y = radius * Math.sin(phi)
    this.camera.position.z = radius * Math.cos(phi) * Math.sin(theta)

    // Always look at the center
    this.camera.lookAt(0, 0, 0)
    this.camera.up.set(0, 1, 0) // Keep "up" direction consistent
  }

  createStarField() {
    const starsGeometry = new THREE.BufferGeometry()
    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.02,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    })

    const starsVertices = []
    const radius = 10 // Radius of our star sphere
    const starsCount = 2000 // Number of stars

    for (let i = 0; i < starsCount; i++) {
      // Create random spherical coordinates
      const theta = 2 * Math.PI * Math.random()
      const phi = Math.acos(2 * Math.random() - 1)
      const x = radius * Math.sin(phi) * Math.cos(theta)
      const y = radius * Math.sin(phi) * Math.sin(theta)
      const z = radius * Math.cos(phi)

      starsVertices.push(x, y, z)
    }

    starsGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(starsVertices, 3),
    )

    this.stars = new THREE.Points(starsGeometry, starsMaterial)
    this.scene.add(this.stars)
  }

  createGlobe() {
    // Ensure any previous globe and animation is removed
    this.removeGlobe()

    // Initialize scene, camera, renderer, etc.
    this.scene = new THREE.Scene()
    const height = window.innerHeight - 100
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / height,
      0.1,
      1000,
    )

    // Set initial camera position
    this.cameraDistance = 1
    this.updateCameraPosition()

    // Set up renderer with alpha and better quality
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(window.innerWidth, height)
    this.renderer.setClearColor(0x000000) // Set background to black
    document.body.prepend(this.renderer.domElement)

    // Create starry background
    this.createStarField()

    // Create Earth with better lighting
    const geometry = new THREE.SphereGeometry(0.5, 32, 32)
    const texture = new THREE.TextureLoader().load("earth_atmos_2048.jpg")

    // Use PhongMaterial for better lighting
    const material = new THREE.MeshPhongMaterial({
      map: texture,
      specular: 0x333333,
      shininess: 5,
    })

    this.earth = new THREE.Mesh(geometry, material)
    this.scene.add(this.earth)

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xfffffff)
    this.scene.add(ambientLight)

    // Add directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4)
    directionalLight.position.set(5, 3, 5)
    this.scene.add(directionalLight)

    // Add mouse and zoom controls
    this.setupMouseControls()
    this.setupZoomControls()

    // Start the animation loop
    this.animate()

    return this
  }

  setupMouseControls() {
    const canvas = this.renderer.domElement

    canvas.addEventListener("mousedown", (e) => {
      this.isDragging = true
      this.previousMousePosition = {
        x: e.clientX,
        y: e.clientY,
      }
    })

    canvas.addEventListener("mousemove", (e) => {
      if (!this.isDragging) return

      const deltaMove = {
        x: e.clientX - this.previousMousePosition.x,
        y: e.clientY - this.previousMousePosition.y,
      }

      // Adjust rotation speed based on movement
      const rotationSpeed = 0.005

      // Update camera orbit angles
      this.cameraRotation.y += deltaMove.x * rotationSpeed
      this.cameraRotation.x += deltaMove.y * rotationSpeed

      // Limit vertical rotation to prevent flipping
      this.cameraRotation.x = Math.max(
        -Math.PI / 2 + 0.1,
        Math.min(Math.PI / 2 - 0.1, this.cameraRotation.x),
      )

      // Update camera position
      this.updateCameraPosition()

      this.previousMousePosition = {
        x: e.clientX,
        y: e.clientY,
      }
    })

    window.addEventListener("mouseup", () => {
      this.isDragging = false
    })

    canvas.addEventListener("selectstart", (e) => {
      e.preventDefault()
    })
  }

  setupZoomControls() {
    const canvas = this.renderer.domElement

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault()

      const zoomDelta = e.deltaY > 0 ? -this.zoomSpeed : this.zoomSpeed

      this.currentZoom = Math.max(
        this.minZoom,
        Math.min(this.maxZoom, this.currentZoom + zoomDelta),
      )

      this.updateCameraPosition()
    })

    let touchDistance = 0

    canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length === 2) {
        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        touchDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY,
        )
      }
    })

    canvas.addEventListener("touchmove", (e) => {
      if (e.touches.length === 2) {
        e.preventDefault()

        const touch1 = e.touches[0]
        const touch2 = e.touches[1]
        const newDistance = Math.hypot(
          touch2.clientX - touch1.clientX,
          touch2.clientY - touch1.clientY,
        )

        const delta = newDistance - touchDistance
        const zoomDelta = delta * 0.01 * this.zoomSpeed

        this.currentZoom = Math.max(
          this.minZoom,
          Math.min(this.maxZoom, this.currentZoom + zoomDelta),
        )

        this.updateCameraPosition()
        touchDistance = newDistance
      }
    })
  }

  animate() {
    if (!this.earth) return

    const { earth, spikes, renderer, scene, camera } = this

    this.animationId = requestAnimationFrame(this.animate.bind(this))

    const currentTime = Date.now()
    const delta = (currentTime - (this.lastFrameTime || currentTime)) / 1000
    this.lastFrameTime = currentTime

    // Spawn new drones
    if (
      currentTime - this.lastDroneSpawn > this.droneSpawnInterval &&
      this.drones.length < this.maxDrones
    ) {
      this.drones.push(new Drone(this))
      this.lastDroneSpawn = currentTime
    }

    // Update drones
    this.drones.forEach((drone) => drone.update(delta))

    const AUTO_ROTATE_SPEED = 0.0003

    // Auto-rotate camera when not dragging
    if (this.shouldRotate && !this.isDragging) {
      this.cameraRotation.y += AUTO_ROTATE_SPEED
      this.updateCameraPosition()
    }

    // Update spikes
    spikes.forEach((spike, index) => {
      spike.scale.y *= 0.95
      if (spike.scale.y < 0.01) {
        earth.remove(spike)
        spikes.splice(index, 1)
      }
    })

    renderer.render(scene, camera)
  }

  removeGlobe() {
    // Cancel the previous animation frame to stop multiple animations
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
    }

    // Remove event listeners if they exist
    if (this.renderer) {
      const canvas = this.renderer.domElement
      canvas.removeEventListener("mousedown", this.onMouseDown)
      canvas.removeEventListener("mousemove", this.onMouseMove)
      canvas.removeEventListener("selectstart", this.onSelectStart)
    }

    // Dispose of the renderer, scene, and event listeners
    if (this.renderer) {
      this.renderer.dispose()
      this.renderer.domElement.remove()
    }
    if (this.scene) {
      while (this.scene.children.length > 0) {
        const object = this.scene.children[0]
        if (object.geometry) object.geometry.dispose()
        if (object.material) object.material.dispose()
        this.scene.remove(object)
      }
    }
    this.spikes = []
    this.renderer = null
    this.scene = null
    this.earth = null
  }

  latLongToVector3(lat, lon) {
    const phi = (90 - lat) * (Math.PI / 180)
    const theta = (lon + 180) * (Math.PI / 180)
    const x = -0.5 * Math.sin(phi) * Math.cos(theta)
    const y = 0.5 * Math.cos(phi)
    const z = 0.5 * Math.sin(phi) * Math.sin(theta)
    return new THREE.Vector3(x, y, z)
  }

  visualizeHit(request) {
    const { lat, long, type } = request
    const position = this.latLongToVector3(lat, long)

    const spikeGeometry = new THREE.ConeGeometry(0.005, 0.3, 8)
    spikeGeometry.translate(0, 0.05, 0)
    spikeGeometry.rotateX(Math.PI / 2)

    const color = type === "read" ? 0xffffff : 0x00ff00
    const spikeMaterial = new THREE.MeshBasicMaterial({ color })

    const spike = new THREE.Mesh(spikeGeometry, spikeMaterial)
    spike.position.set(position.x, position.y, position.z)
    spike.lookAt(new THREE.Vector3(0, 0, 0))

    this.earth.add(spike) // Add spike to earth instead of scene
    this.spikes.push(spike)
  }

  listenToResize() {
    window.addEventListener("resize", () => {
      this.createGlobe() // Recreate the globe on resize
    })
    return this
  }

  listenForClicks() {
    document.body.addEventListener("dblclick", () => {
      if (!document.fullscreenElement) {
        document.body.requestFullscreen().catch((err) => {
          console.log(
            `Error trying to go fullscreen: ${err.message} (${err.name})`,
          )
        })
      } else {
        document.exitFullscreen()
      }
    })

    // Pause/Resume on single-click
    document.body.addEventListener(
      "click",
      () => (this.shouldRotate = !this.shouldRotate),
    )
    return this
  }

  shouldRotate = true

  bindToSSE() {
    const logContainer = document.getElementById("log-container")
    const urlParams = new URLSearchParams(window.location.search)
    const folderName = urlParams.get("folderName")
    const queryString = folderName ? `?folderName=${folderName}` : ""
    if (folderName)
      document.querySelector("#summaryLink").href =
        "summarizeRequests.htm?folderName=" + folderName
    else document.querySelector("#summaryLink").href = "requests.html"
    const eventSource = new EventSource(`/requests.htm${queryString}`)
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      const logEntry = document.createElement("div")
      logEntry.textContent = data.log
      logContainer.appendChild(logEntry)
      logContainer.scrollTop = logContainer.scrollHeight

      const parts = data.log.split(" ")
      const long = parseFloat(parts.pop())
      const lat = parseFloat(parts.pop())
      const type = parts.shift()
      const page = parts.shift()

      const request = {
        lat,
        long,
        type,
        page,
      }
      this.visualizeHit(request)
    }

    eventSource.onerror = (error) => {
      console.error("EventSource failed:", error)
      eventSource.close()
    }

    eventSource.onopen = (event) => {
      console.log("SSE connection opened")
    }

    return this
  }
}

window.globe = new Globe().createGlobe().listenToResize().listenForClicks()

// Add the control panel after initialization
window.globe.createControlPanel()
