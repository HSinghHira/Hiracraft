// ============================================================================
// Splash Text Loader
// ============================================================================
const SplashLoader = (() => {
  const DEFAULT_SPLASH = 'Minecraft!';
  
  function loadSplashes(callback) {
    fetch('/splashes.json')
      .then(response => response.json())
      .then(callback)
      .catch(error => {
        console.error('Error loading splashes:', error);
        callback([DEFAULT_SPLASH]);
      });
  }
  
  function displayRandomSplash(splashes) {
    const splashElem = document.querySelector('.splash');
    if (!splashElem) return;
    
    const randomIndex = Math.floor(Math.random() * splashes.length);
    splashElem.textContent = splashes[randomIndex];
  }
  
  return { init: () => loadSplashes(displayRandomSplash) };
})();

// ============================================================================
// Panoramic Background (Three.js)
// ============================================================================
const PanoramicBackground = (() => {
  let camera, scene, renderer;
  let radX = 0;
  let radY = 0;
  let animationFrameId = null;
  
  const config = {
    rotationSpeedX: 0.001,
    rotationSpeedY: 0.0001,
    fov: 90,
    near: 0.1,
    far: 100,
    cameraZ: 0.01,
    tilesCount: 6,
    panoramaPath: '/img/panorama.jpg'
  };
  
  function createTextures(atlasUrl, tilesNum) {
    const textures = Array.from({ length: tilesNum }, () => new THREE.Texture());
    const image = new Image();
    
    image.onload = () => {
      const tileWidth = image.height;
      
      textures.forEach((texture, i) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = canvas.height = tileWidth;
        context.drawImage(
          image,
          tileWidth * i, 0, tileWidth, tileWidth,
          0, 0, tileWidth, tileWidth
        );
        
        texture.image = canvas;
        texture.needsUpdate = true;
      });
    };
    
    image.src = atlasUrl;
    return textures;
  }
  
  function init() {
    const container = document.getElementById('container');
    if (!container) {
      console.error('Container element not found');
      return false;
    }
    
    // Setup renderer
    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    container.appendChild(renderer.domElement);
    
    // Setup scene
    scene = new THREE.Scene();
    
    // Setup camera
    camera = new THREE.PerspectiveCamera(
      config.fov,
      window.innerWidth / window.innerHeight,
      config.near,
      config.far
    );
    camera.position.z = config.cameraZ;
    
    // Create skybox
    const textures = createTextures(config.panoramaPath, config.tilesCount);
    const materials = textures.map(texture => 
      new THREE.MeshBasicMaterial({ map: texture })
    );
    
    const skyBox = new THREE.Mesh(
      new THREE.CubeGeometry(1, 1, 1),
      new THREE.MeshFaceMaterial(materials)
    );
    skyBox.applyMatrix(new THREE.Matrix4().makeScale(1, 1, -1));
    scene.add(skyBox);
    
    // Event listeners
    window.addEventListener('resize', handleResize, false);
    
    return true;
  }
  
  function handleResize() {
    if (!camera || !renderer) return;
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  
  function update() {
    radX += config.rotationSpeedX;
    radY += config.rotationSpeedY;
    
    const x = -Math.sin(radX) * Math.cos(radY);
    const y = Math.sin(radX) * Math.sin(radY);
    const z = Math.cos(radX);
    
    camera.position.set(0, 0, 0);
    camera.lookAt(new THREE.Vector3(x, y, z));
    
    renderer.render(scene, camera);
  }
  
  function animate() {
    animationFrameId = requestAnimationFrame(animate);
    update();
  }
  
  function start() {
    if (init()) {
      animate();
    }
  }
  
  function stop() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }
  
  return { start, stop };
})();

// ============================================================================
// Language Manager
// ============================================================================
const LanguageManager = (() => {
  const STORAGE_KEY = 'minecraftLang';
  let currentLanguageIndex = 0;
  let translations = {};
  let availableLanguages = [];
  
  function getStoredLanguageIndex() {
    try {
      return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
    } catch (error) {
      console.error('Error reading language preference:', error);
      return 0;
    }
  }
  
  function saveLanguageIndex(index) {
    try {
      localStorage.setItem(STORAGE_KEY, index.toString());
    } catch (error) {
      console.error('Error saving language preference:', error);
    }
  }
  
  function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => 
      current?.[key], obj
    );
  }
  
  function updateTranslations() {
    const language = availableLanguages[currentLanguageIndex];
    if (!language) return;
    
    const langCode = language.code;
    const trans = translations[langCode];
    
    if (!trans) return;
    
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const value = getNestedValue(trans, key);
      
      if (value && typeof value === 'string') {
        element.textContent = value;
      }
    });
    
    document.documentElement.lang = langCode;
    saveLanguageIndex(currentLanguageIndex);
  }
  
  function cycleLanguage() {
    currentLanguageIndex = (currentLanguageIndex + 1) % availableLanguages.length;
    updateTranslations();
  }
  
  function init(translationsData, languagesData) {
    translations = translationsData;
    availableLanguages = languagesData;
    currentLanguageIndex = getStoredLanguageIndex();
    
    const langButton = document.getElementById('langButton');
    if (langButton) {
      langButton.addEventListener('click', (e) => {
        e.preventDefault();
        cycleLanguage();
      });
    }
    
    updateTranslations();
  }
  
  return { init };
})();

// ============================================================================
// Minecraft Launcher
// ============================================================================
const MinecraftLauncher = (() => {
  const HTML_TEMPLATE = `<!DOCTYPE html>\r\n<html lang=\"en\" style=\"width: 100%; height: 100%; background-color: black;\">\r\n<head>\r\n  <meta charset=\"UTF-8\">\r\n  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0\">\r\n  <meta name=\"apple-mobile-web-app-title\" content=\"MC\">\r\n  \r\n  <title>Minecraft Online<\/title>\r\n  \r\n  <!-- Favicons -->\r\n  <link rel=\"icon\" type=\"image\/png\" href=\"\/favicon-96x96.png\" sizes=\"96x96\">\r\n  <link rel=\"icon\" type=\"image\/svg+xml\" href=\"\/favicon.svg\">\r\n  <link rel=\"shortcut icon\" href=\"\/favicon.ico\">\r\n  <link rel=\"apple-touch-icon\" sizes=\"180x180\" href=\"\/apple-touch-icon.png\">\r\n  <link rel=\"manifest\" href=\"\/site.webmanifest\">\r\n  \r\n  <!-- Styles -->\r\n  <style>\r\n    html, body {\r\n      margin: 0;\r\n      width: 100%;\r\n      height: 100%;\r\n      background: #000;\r\n      overflow: hidden;\r\n    }\r\n\r\n    .webgl-content {\r\n      width: 100vw;\r\n      height: 100vh;\r\n    }\r\n\r\n    #game_frame {\r\n      width: 100%;\r\n      height: 100%;\r\n    }\r\n\r\n    \/* WASM Modal Styles *\/\r\n    .wasm-modal {\r\n      display: none;\r\n      position: absolute;\r\n      left: 0;\r\n      top: 0;\r\n      right: 0;\r\n      z-index: 1000;\r\n    }\r\n\r\n    .wasm-modal__container {\r\n      margin: auto;\r\n      max-width: 650px;\r\n    }\r\n\r\n    .wasm-modal__content {\r\n      margin: 20px;\r\n      border: 5px double black;\r\n      padding: 10px;\r\n      background-color: white;\r\n      text-align: center;\r\n      font-family: sans-serif;\r\n      font-size: 1.2em;\r\n    }\r\n\r\n    .wasm-modal__title {\r\n      margin: 0.5em 0;\r\n      font-size: 1.2em;\r\n    }\r\n\r\n    .wasm-modal__text {\r\n      margin: 1em 0;\r\n    }\r\n\r\n    .wasm-modal__checkbox-container {\r\n      margin: 1em 0;\r\n    }\r\n\r\n    .wasm-modal__checkbox {\r\n      zoom: 1.5;\r\n      margin-right: 0.5em;\r\n    }\r\n\r\n    .wasm-modal__button {\r\n      zoom: 1.5;\r\n      margin: 0.5em;\r\n      padding: 0.5em 1em;\r\n      cursor: pointer;\r\n    }\r\n\r\n    .wasm-modal__button:hover {\r\n      opacity: 0.8;\r\n    }\r\n  <\/style>\r\n  \r\n  <!-- Eaglercraft Configuration -->\r\n  <script>\r\n    window.disableUserscripts = true;\r\n    window.__eaglercraftLoaderClient = {\r\n      container: \"game_frame\",\r\n      name: \"Eaglercraft 1.12\",\r\n      file: \"net.peytonplayz585.eaglercraft.v1_12.client\",\r\n      cid: \"bafybeidrnchyech7b26rqhm3tayt7p6mxvl23lzd4f5mcyqda7hbrzyal4\",\r\n      path: \"\",\r\n      download: \"\/js\/1.12.2.gz\",\r\n      dlSize: 15601341,\r\n      gzip: true\r\n    };\r\n  <\/script>\r\n  \r\n  <!-- Backend Script -->\r\n  <script src=\"\/js\/backend.js\"><\/script>\r\n<\/head>\r\n\r\n<body>\r\n  <div class=\"webgl-content\">\r\n    <!-- WebAssembly Upgrade Modal -->\r\n    <div id=\"eaglerWASMAvailable\" class=\"wasm-modal\" role=\"dialog\" aria-labelledby=\"wasmModalTitle\" aria-hidden=\"true\">\r\n      <div class=\"wasm-modal__container\">\r\n        <div class=\"wasm-modal__content\">\r\n          <h3 id=\"wasmModalTitle\" class=\"wasm-modal__title\">\r\n            Eaglercraft WebAssembly GC is supported on your browser, would you like to try it?\r\n          <\/h3>\r\n          \r\n          <p class=\"wasm-modal__text\">\r\n            The new variant of Eaglercraft gets almost <strong>2x the FPS<\/strong>, \r\n            however it may crash if your device doesn\'t have a lot of memory.\r\n          <\/p>\r\n          \r\n          <p class=\"wasm-modal__text\">\r\n            Your existing singleplayer worlds will be available.\r\n          <\/p>\r\n          \r\n          <div class=\"wasm-modal__checkbox-container\">\r\n            <label for=\"eaglerWASMAvailableDontShow\">\r\n              <input \r\n                type=\"checkbox\" \r\n                class=\"wasm-modal__checkbox\" \r\n                id=\"eaglerWASMAvailableDontShow\"\r\n                aria-label=\"Do not show this message again\"\r\n              >\r\n              Do not show again\r\n            <\/label>\r\n          <\/div>\r\n          \r\n          <p>\r\n            <button \r\n              id=\"eaglerWASMAvailableYes\" \r\n              class=\"wasm-modal__button\"\r\n              aria-label=\"Switch to WebAssembly version\"\r\n            >\r\n              (Likely Blocked) Switch to WebAssembly version\r\n            <\/button>\r\n          <\/p>\r\n          \r\n          <p>\r\n            <button \r\n              id=\"eaglerWASMAvailableNo\" \r\n              class=\"wasm-modal__button\"\r\n              aria-label=\"Continue with current version\"\r\n            >\r\n              Continue\r\n            <\/button>\r\n          <\/p>\r\n        <\/div>\r\n      <\/div>\r\n    <\/div>\r\n\r\n    <!-- Game Container -->\r\n    <div id=\"game_frame\"><\/div>\r\n  <\/div>\r\n\r\n  <!-- WebAssembly Modal Handler -->\r\n  <script>\r\n    (function initWebAssemblyModal() {\r\n      \'use strict\';\r\n\r\n      \/\/ Configuration\r\n      const CONFIG = {\r\n        STORAGE_KEY: \'hideEaglerWASMAvailable\',\r\n        WASM_URL: \'https:\/\/eaglercraft.com\/mc\/1.12.2-wasm\/\',\r\n        MODAL_ID: \'eaglerWASMAvailable\',\r\n        CHECKBOX_ID: \'eaglerWASMAvailableDontShow\',\r\n        YES_BUTTON_ID: \'eaglerWASMAvailableYes\',\r\n        NO_BUTTON_ID: \'eaglerWASMAvailableNo\'\r\n      };\r\n\r\n      \/**\r\n       * Check if WebAssembly with Suspending API is supported\r\n       *\/\r\n      function isWebAssemblySupported() {\r\n        return typeof WebAssembly !== \'undefined\' && \r\n               typeof WebAssembly.Suspending !== \'undefined\';\r\n      }\r\n\r\n      \/**\r\n       * Check if user has chosen to hide the modal\r\n       *\/\r\n      function shouldHideModal() {\r\n        try {\r\n          return window.localStorage.getItem(CONFIG.STORAGE_KEY) === \'true\';\r\n        } catch (error) {\r\n          console.error(\'Error reading localStorage:\', error);\r\n          return false;\r\n        }\r\n      }\r\n\r\n      \/**\r\n       * Save user preference to hide modal\r\n       *\/\r\n      function saveHidePreference() {\r\n        try {\r\n          window.localStorage.setItem(CONFIG.STORAGE_KEY, \'true\');\r\n        } catch (error) {\r\n          console.error(\'Error saving to localStorage:\', error);\r\n        }\r\n      }\r\n\r\n      \/**\r\n       * Get DOM elements\r\n       *\/\r\n      function getElements() {\r\n        return {\r\n          modal: document.getElementById(CONFIG.MODAL_ID),\r\n          checkbox: document.getElementById(CONFIG.CHECKBOX_ID),\r\n          yesButton: document.getElementById(CONFIG.YES_BUTTON_ID),\r\n          noButton: document.getElementById(CONFIG.NO_BUTTON_ID)\r\n        };\r\n      }\r\n\r\n      \/**\r\n       * Handle user preference based on checkbox state\r\n       *\/\r\n      function handleDontShowAgain(checkbox) {\r\n        if (checkbox && checkbox.checked) {\r\n          saveHidePreference();\r\n        }\r\n      }\r\n\r\n      \/**\r\n       * Show the WebAssembly modal\r\n       *\/\r\n      function showModal(elements) {\r\n        if (!elements.modal) return;\r\n\r\n        elements.modal.style.display = \'block\';\r\n        elements.modal.setAttribute(\'aria-hidden\', \'false\');\r\n      }\r\n\r\n      \/**\r\n       * Hide the WebAssembly modal\r\n       *\/\r\n      function hideModal(elements) {\r\n        if (!elements.modal) return;\r\n\r\n        elements.modal.style.display = \'none\';\r\n        elements.modal.setAttribute(\'aria-hidden\', \'true\');\r\n      }\r\n\r\n      \/**\r\n       * Set up event listeners for modal buttons\r\n       *\/\r\n      function setupEventListeners(elements) {\r\n        \/\/ Yes button - navigate to WASM version\r\n        if (elements.yesButton) {\r\n          elements.yesButton.addEventListener(\'click\', function() {\r\n            handleDontShowAgain(elements.checkbox);\r\n            window.location.href = CONFIG.WASM_URL;\r\n          });\r\n        }\r\n\r\n        \/\/ No button - close modal\r\n        if (elements.noButton) {\r\n          elements.noButton.addEventListener(\'click\', function() {\r\n            handleDontShowAgain(elements.checkbox);\r\n            hideModal(elements);\r\n          });\r\n        }\r\n      }\r\n\r\n      \/**\r\n       * Initialize the WebAssembly modal\r\n       *\/\r\n      function init() {\r\n        \/\/ Check WebAssembly support\r\n        if (!isWebAssemblySupported()) {\r\n          return;\r\n        }\r\n\r\n        \/\/ Check if user has chosen to hide\r\n        if (shouldHideModal()) {\r\n          return;\r\n        }\r\n\r\n        \/\/ Get DOM elements\r\n        const elements = getElements();\r\n\r\n        \/\/ Verify elements exist\r\n        if (!elements.modal || !elements.yesButton || !elements.noButton) {\r\n          console.error(\'Required modal elements not found\');\r\n          return;\r\n        }\r\n\r\n        \/\/ Setup event listeners\r\n        setupEventListeners(elements);\r\n\r\n        \/\/ Show modal\r\n        showModal(elements);\r\n      }\r\n\r\n      \/\/ Run initialization when page loads\r\n      window.addEventListener(\'load\', init);\r\n    })();\r\n  <\/script>\r\n<\/body>\r\n<\/html>`;
  
  function launch() {
    const newTab = window.open('about:blank', '_blank');
    if (!newTab) {
      console.error('Failed to open new tab. Popup may be blocked.');
      return;
    }
    
    const doc = newTab.document;
    doc.write(HTML_TEMPLATE);
    doc.close();
  }
  
  function init() {
    const singleplayerButton = document.getElementById('singleplayerButton');
    if (singleplayerButton) {
      singleplayerButton.addEventListener('click', launch);
    }
  }
  
  return { init };
})();

// ============================================================================
// Application Initialization
// ============================================================================
(function initApp() {
  // Initialize splash text
  SplashLoader.init();
  
  // Initialize panoramic background
  PanoramicBackground.start();
  
  // Initialize Minecraft launcher
  MinecraftLauncher.init();
  
  // Note: Language manager needs to be initialized from Astro component
  // with translations and availableLanguages data
  window.initLanguage = LanguageManager.init;
})();