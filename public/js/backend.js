"use strict";

// ============================================================================
// Eaglercraft Client Loader - Optimized
// ============================================================================
(() => {
  // ============================================================================
  // Constants & Configuration
  // ============================================================================
  const CONFIG = {
    LOADING_ICON_SRC: "/img/diamond.png",
    CACHE_DB_NAME: "_eagler_loader_cache_v1",
    CACHE_DB_VERSION: 1,
    CACHE_STORE_NAME: "file_cache",
    DOWNLOAD_FAIL_PREFIX: "_eagler_dl_",
    FAIL_TIMEOUT_MS: 21600000, // 6 hours
    LAUNCH_DELAY_MS: 500,
    LAUNCH_DELAY_CACHED_MS: 1500,
    RETRY_DELAY_MS: 1000,
    DEFAULT_SERVER_NAME: "§c§lBy: HARMAN SINGH HIRA",
    DEFAULT_SERVER_URL: "https://me.hsinghhira.me",
    MOBILE_USERSCRIPTS: ["flameddogo99-eaglermobile.js", "irv77-eaglercraft-mobile.js"],
    WS_TIMEOUT_BASE_MS: 100000,
    WS_TIMEOUT_RANDOM_MS: 20000
  };

  // ============================================================================
  // State Management
  // ============================================================================
  const state = {
    opts: {},
    progressPanel: null,
    progressStr1: null,
    progressStr2: null,
    progressStr3: null,
    progressBarOuter: null,
    progressBarInner: null,
    cancelButton: null,
    currentXHR: null
  };

  // ============================================================================
  // IPFS Gateway Configuration
  // ============================================================================
  const IPFSGateway = (() => {
    const createPatternA = (domain) => 
      (cid, path) => `https://${domain}/ipfs/${cid}/${path}`;
    
    const createPatternB = (domain) => 
      (cid, path) => `https://${cid}.ipfs.${domain}/${path}`;

    const GATEWAYS = [
      createPatternA("gateway.ipfs.io"),
      createPatternB("4everland.io"),
      createPatternB("dweb.link"),
      createPatternA("cloudflare-ipfs.com"),
      createPatternB("cf-ipfs.com"),
      createPatternA("w3s.link"),
      createPatternA("storry.tv"),
      createPatternB("nftstorage.link")
    ];

    return { GATEWAYS };
  })();

  // ============================================================================
  // Console Interceptor
  // ============================================================================
  const ConsoleInterceptor = (() => {
    const originalLog = console.log;

    function init() {
      console.log = (...args) => {
        if (args.length > 0 && 
            typeof args[0] === 'string' && 
            args[0].includes(`Connecting to: wss://${CONFIG.DEFAULT_SERVER_URL}`)) {
          window.open(CONFIG.DEFAULT_SERVER_URL, "_blank");
        }
        originalLog.apply(console, args);
      };
    }

    return { init };
  })();

  // ============================================================================
  // Server Configuration Override
  // ============================================================================
  const ServerConfig = (() => {
    function init() {
      Object.defineProperty(window, 'eaglercraftXOpts', {
        configurable: true,
        enumerable: true,
        set(value) {
          value.servers = [{
            addr: CONFIG.DEFAULT_SERVER_URL,
            name: CONFIG.DEFAULT_SERVER_NAME
          }];
          this._eaglercraftXOpts = value;
        },
        get() {
          return this._eaglercraftXOpts;
        }
      });
    }

    return { init };
  })();

  // ============================================================================
  // File Decompression
  // ============================================================================
  const FileDecompressor = (() => {
    async function decompress(arrayBuffer) {
      try {
        const stream = new DecompressionStream("gzip");
        const blob = new Blob([arrayBuffer]);
        const decompressedStream = blob.stream().pipeThrough(stream);
        const reader = decompressedStream.getReader();
        const chunks = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }

        return new Blob(chunks).arrayBuffer();
      } catch (error) {
        console.error("Could not decompress file!");
        console.error(error);
        return null;
      }
    }

    return { decompress };
  })();

  // ============================================================================
  // File Downloader
  // ============================================================================
  const FileDownloader = (() => {
    function download(url) {
      return new Promise((resolve) => {
        const xhr = state.currentXHR = new XMLHttpRequest();
        
        if (state.cancelButton) {
          state.cancelButton.disabled = false;
          state.cancelButton.style.display = "inline";
        }

        xhr.open("GET", url);
        xhr.responseType = "arraybuffer";

        xhr.addEventListener("progress", (evt) => {
          const loadedKB = Math.round(evt.loaded * 0.001);
          const totalKB = Math.round(state.opts.dlSize * 0.001);
          const progress = Math.min(evt.loaded / state.opts.dlSize, 1.0);
          ProgressUI.updateBar(`Update: ${loadedKB} / ${totalKB} kB`, url, progress);
        });

        xhr.addEventListener("readystatechange", () => {
          if (xhr.readyState === XMLHttpRequest.DONE) {
            const totalKB = Math.round(state.opts.dlSize * 0.001);
            ProgressUI.updateBar(`Update: ${totalKB} / ${totalKB} kB`, url, 1.0);
            
            if (state.cancelButton) {
              state.cancelButton.disabled = true;
            }
            state.currentXHR = null;

            if (xhr.status === 200) {
              resolve(xhr.response);
            } else {
              console.error(`Got response code ${xhr.status} for: ${url}`);
              resolve(null);
            }
          }
        });

        xhr.addEventListener("error", () => {
          if (state.cancelButton) {
            state.cancelButton.disabled = true;
          }
          state.currentXHR = null;
          console.error(`Could not complete request to: ${url}`);
          resolve(null);
        });

        xhr.addEventListener("load", () => {
          if (state.cancelButton) {
            state.cancelButton.disabled = true;
          }
          state.currentXHR = null;
        });

        xhr.addEventListener("abort", () => {
          console.error(`Request aborted: ${url}`);
          if (state.cancelButton) {
            state.cancelButton.disabled = true;
          }
          state.currentXHR = null;
          resolve(null);
        });

        xhr.send();
      });
    }

    async function downloadClient(downloadUrl) {
      const totalKB = Math.round(state.opts.dlSize * 0.001);
      
      for (let i = 0; i < IPFSGateway.GATEWAYS.length; i++) {
        ProgressUI.updateBar(`Update: 0 / ${totalKB} kB`, downloadUrl, 0.0);
        
        try {
          let data = await download(downloadUrl);
          
          if (data) {
            if (state.opts.gzip) {
              try {
                ProgressUI.updateBar("Extracting...", downloadUrl, -1);
                data = await FileDecompressor.decompress(data);
                
                if (data) {
                  return data;
                } else {
                  throw new Error("Decompression returned null");
                }
              } catch (error) {
                ProgressUI.updateBar("Client decompress failed!", downloadUrl, -1);
                console.error(`Caught exception during decompress: ${downloadUrl}`);
                console.error(error);
              }
            } else {
              return data;
            }
          } else {
            throw new Error("Download returned null");
          }
        } catch (error) {
          ProgressUI.updateBar("Client download failed!", downloadUrl, 1.0);
          console.error(`Caught exception during download: ${downloadUrl}`);
          console.error(error);
        }
        
        await delay(CONFIG.RETRY_DELAY_MS);
      }
      
      return null;
    }

    return { downloadClient };
  })();

  // ============================================================================
  // IndexedDB Cache Manager
  // ============================================================================
  const CacheManager = (() => {
    function openDatabase() {
      return new Promise((resolve, reject) => {
        const request = window.indexedDB.open(
          CONFIG.CACHE_DB_NAME,
          CONFIG.CACHE_DB_VERSION
        );

        request.addEventListener("upgradeneeded", () => {
          request.result.createObjectStore(CONFIG.CACHE_STORE_NAME, {
            keyPath: "fileName"
          });
        });

        request.addEventListener("success", () => {
          resolve(request.result);
        });

        request.addEventListener("error", () => {
          console.error("Failed to open cache database!");
          console.error(request.error);
          reject(request.error);
        });
      });
    }

    async function load(fileName) {
      try {
        const db = await openDatabase();
        
        return new Promise((resolve) => {
          db.addEventListener("error", (err) => {
            console.error("Error loading from cache database!");
            console.error(err);
          });

          const transaction = db.transaction([CONFIG.CACHE_STORE_NAME], "readonly");
          const request = transaction.objectStore(CONFIG.CACHE_STORE_NAME).get(fileName);

          request.addEventListener("success", () => {
            resolve(request.result);
          });

          transaction.addEventListener("success", () => {
            db.close();
          });

          transaction.addEventListener("error", () => {
            db.close();
            console.error("Failed to load from cache database!");
            resolve(null);
          });
        });
      } catch (error) {
        console.error("Failed to load from cache:", error);
        return null;
      }
    }

    async function save(fileData) {
      try {
        const db = await openDatabase();
        
        return new Promise((resolve) => {
          db.addEventListener("error", (err) => {
            console.error("Error saving to cache database!");
            console.error(err);
          });

          const transaction = db.transaction([CONFIG.CACHE_STORE_NAME], "readwrite");
          const request = transaction.objectStore(CONFIG.CACHE_STORE_NAME).put(fileData);

          request.addEventListener("success", () => {
            resolve(true);
          });

          transaction.addEventListener("success", () => {
            db.close();
          });

          transaction.addEventListener("error", (evt) => {
            db.close();
            console.error("Failed to save to cache database!");
            console.error(evt);
            resolve(false);
          });
        });
      } catch (error) {
        console.error("Failed to save to cache:", error);
        return false;
      }
    }

    return { load, save };
  })();

  // ============================================================================
  // Download Failure Tracker
  // ============================================================================
  const FailureTracker = (() => {
    function hasDownloadFailed(cidPath) {
      if (!window.localStorage) return false;

      try {
        const failedAtStr = window.localStorage.getItem(
          `${CONFIG.DOWNLOAD_FAIL_PREFIX}${cidPath}.failedAt`
        );
        
        if (failedAtStr) {
          const failedAt = parseInt(failedAtStr, 10);
          const timeSince = Date.now() - failedAt;
          
          if (timeSince < CONFIG.FAIL_TIMEOUT_MS) {
            return true;
          } else {
            window.localStorage.removeItem(
              `${CONFIG.DOWNLOAD_FAIL_PREFIX}${cidPath}.failedAt`
            );
            return false;
          }
        }
      } catch (error) {
        console.error("Error checking download failure:", error);
      }
      
      return false;
    }

    function setDownloadFailed(cidPath) {
      if (!window.localStorage) return;

      try {
        window.localStorage.setItem(
          `${CONFIG.DOWNLOAD_FAIL_PREFIX}${cidPath}.failedAt`,
          String(Date.now())
        );
      } catch (error) {
        console.error("Error setting download failure:", error);
      }
    }

    return { hasDownloadFailed, setDownloadFailed };
  })();

  // ============================================================================
  // Progress UI
  // ============================================================================
  const ProgressUI = (() => {
    function init() {
      if (state.progressPanel) return;

      state.progressPanel = document.createElement("div");
      state.progressPanel.setAttribute("style",
        "margin:0px;width:100%;height:100%;font-family:sans-serif;" +
        "display:flex;align-items:center;user-select:none;"
      );

      const inner = document.createElement("div");
      inner.setAttribute("style", "margin:auto;text-align:center;");

      // Icon
      const iconContainer = document.createElement("h2");
      const icon = document.createElement("img");
      icon.style.imageRendering = "pixelated";
      icon.width = 200;
      icon.height = 200;
      icon.src = CONFIG.LOADING_ICON_SRC;
      iconContainer.appendChild(icon);
      inner.appendChild(iconContainer);

      // Progress text 1
      state.progressStr1 = document.createElement("h2");
      state.progressStr1.innerText = "Please Wait...";
      inner.appendChild(state.progressStr1);

      // Progress text 2
      state.progressStr2 = document.createElement("h3");
      inner.appendChild(state.progressStr2);

      // Progress bar
      state.progressBarOuter = document.createElement("div");
      state.progressBarOuter.setAttribute("style",
        "border:2px solid transparent;width:400px;height:15px;" +
        "padding:1px;margin:auto;margin-bottom:5px;"
      );
      
      state.progressBarInner = document.createElement("div");
      state.progressBarInner.setAttribute("style",
        "background-color:#AA0000;width:0%;height:100%;"
      );
      
      state.progressBarOuter.appendChild(state.progressBarInner);
      inner.appendChild(state.progressBarOuter);

      // Progress text 3
      state.progressStr3 = document.createElement("h5");
      inner.appendChild(state.progressStr3);

      // Cancel button
      const buttonContainer = document.createElement("p");
      buttonContainer.setAttribute("style", "margin-bottom:20vh;");
      
      state.cancelButton = document.createElement("button");
      state.cancelButton.innerText = "Cancel";
      state.cancelButton.style.display = "none";
      state.cancelButton.disabled = true;
      state.cancelButton.addEventListener("click", () => {
        if (state.currentXHR) {
          state.currentXHR.abort();
          state.currentXHR = null;
        }
      });
      
      buttonContainer.appendChild(state.cancelButton);
      inner.appendChild(buttonContainer);

      state.progressPanel.appendChild(inner);

      const container = document.getElementById(state.opts.container);
      if (container) {
        container.appendChild(state.progressPanel);
      }
    }

    function updateScreen(message) {
      if (state.progressStr1) {
        state.progressStr1.innerText = message;
      }
    }

    function updateBar(message, url, progress) {
      if (state.progressStr2) {
        state.progressStr2.innerText = message;
      }
      
      if (state.progressStr3) {
        state.progressStr3.innerText = url;
      }
      
      if (state.progressBarOuter && state.progressBarInner) {
        if (progress < 0.0) {
          state.progressBarOuter.style.border = "2px solid transparent";
          state.progressBarInner.style.width = "0%";
        } else {
          state.progressBarOuter.style.border = "2px solid #FFFFFF";
          state.progressBarInner.style.width = `${Math.floor(progress * 100.0)}%`;
        }
      }
    }

    function remove() {
      if (state.progressPanel) {
        state.progressPanel.remove();
        state.progressPanel = null;
      }
    }

    return { init, updateScreen, updateBar, remove };
  })();

  // ============================================================================
  // Client Loader
  // ============================================================================
  const ClientLoader = (() => {
    function load(arrayBuffer) {
      ProgressUI.remove();
      
      const objURL = URL.createObjectURL(
        new Blob([arrayBuffer], { type: "text/javascript;charset=utf-8" })
      );
      
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.src = objURL;
      document.head.appendChild(script);
    }

    async function run() {
      if (!window.__eaglercraftLoaderClient) {
        console.error("window.__eaglercraftLoaderClient is not defined!");
        return;
      }

      // Load configuration
      const client = window.__eaglercraftLoaderClient;
      state.opts = {
        container: client.container,
        name: client.name,
        file: client.file,
        cid: client.cid,
        path: client.path,
        dlSize: client.dlSize,
        gzip: client.gzip,
        download: client.download
      };

      ProgressUI.init();
      ProgressUI.updateScreen(`Loading ${state.opts.name}`);
      ProgressUI.updateBar("Please wait...", "", -1);

      // Check IndexedDB support
      if (!window.indexedDB) {
        console.error("IndexedDB not supported, downloading client directly...");
        const data = await FileDownloader.downloadClient(state.opts.download);
        
        if (data) {
          ProgressUI.updateBar("Launching...", "Last fetched: now", -1);
          await delay(CONFIG.LAUNCH_DELAY_MS);
          load(data);
        } else {
          ProgressUI.updateScreen("Error: Could not download client!");
          ProgressUI.updateBar("Please try again later", "Direct download failed!", -1);
        }
        return;
      }

      const clientCIDPath = (typeof state.opts.path !== "string" || state.opts.path.length === 0)
        ? state.opts.cid
        : `${state.opts.cid}/${state.opts.path}`;

      const cachedClient = await CacheManager.load(state.opts.file);
      let clientDisplayAge = 0;

      if (cachedClient) {
        clientDisplayAge = Math.floor(
          (Date.now() - cachedClient.clientCachedAt) / 86400000.0
        );
        
        let hasFailed = FailureTracker.hasDownloadFailed(clientCIDPath);
        
        if (hasFailed) {
          hasFailed = confirm(
            `Failed to update the client!\n\nWould you like to use a backup from ${clientDisplayAge} day(s) ago?`
          );
        }

        if (hasFailed || cachedClient.clientVersionUID === clientCIDPath) {
          if (hasFailed) {
            console.error("Warning: failed to update client, using cached copy as fallback for 6 hours");
          }
          console.log("Found client file in cache, launching cached client...");
          ProgressUI.updateBar("Launching...", `Last fetched: ${clientDisplayAge} day(s) ago`, -1);
          await delay(CONFIG.LAUNCH_DELAY_CACHED_MS);
          load(cachedClient.clientPayload);
          return;
        } else {
          console.log("Found client file in cache, client is outdated, attempting to update...");
        }
      } else {
        console.log("Client is not in cache, attempting to download...");
      }

      const data = await FileDownloader.downloadClient(state.opts.download);
      
      if (data) {
        ProgressUI.updateBar("Cacheing...", "Last fetched: now", -1);
        await CacheManager.save({
          fileName: state.opts.file,
          clientVersionUID: clientCIDPath,
          clientCachedAt: Date.now(),
          clientPayload: data
        });
        ProgressUI.updateBar("Launching...", "Last fetched: now", -1);
        await delay(CONFIG.LAUNCH_DELAY_MS);
        load(data);
      } else {
        if (cachedClient) {
          FailureTracker.setDownloadFailed(clientCIDPath);
          
          if (confirm(
            `Failed to update the client!\n\nWould you like to use a backup from ${clientDisplayAge} day(s) ago?`
          )) {
            ProgressUI.updateBar("Launching...", `Last fetched: ${clientDisplayAge} day(s) ago`, -1);
            await delay(CONFIG.LAUNCH_DELAY_CACHED_MS);
            load(cachedClient.clientPayload);
            return;
          }
        }
        ProgressUI.updateScreen("Error: Could not download client!");
        ProgressUI.updateBar("Please try again later", "Client download failed!", -1);
      }
    }

    return { run };
  })();

  // ============================================================================
  // Mobile Detection & Userscript Loader
  // ============================================================================
  const UserscriptManager = (() => {
    function checkNotMobileBrowser() {
      try {
        document.exitPointerLock();
        return !(/Mobi/i.test(window.navigator.userAgent));
      } catch (error) {
        return false;
      }
    }

    function loadUserscript(scriptName) {
      alert("WARNING: These userscripts are 3rd-party creations and might crash your game!");
      
      const script = document.createElement("script");
      script.type = "text/javascript";
      script.src = `/js/userscript/${scriptName}`;
      document.head.appendChild(script);
    }

    function init() {
      if (window.disableUserscripts) return;

      let queryString = window.location.search;
      if (typeof queryString !== "string" || !queryString.startsWith("?")) return;

      const params = new URLSearchParams(queryString);
      const userscript = params.get("userscript");

      if (!userscript) return;
      if (!CONFIG.MOBILE_USERSCRIPTS.includes(userscript)) return;

      if (checkNotMobileBrowser()) {
        if (confirm("Pointer lock is supported on this browser.\n\nWould you like to disable Touch Mode?")) {
          params.delete("userscript");
          const newQuery = params.size > 0 ? `?${params.toString()}` : "";
          window.location.href = window.location.origin + window.location.pathname + newQuery + window.location.hash;
          return;
        }
      }

      loadUserscript(userscript);
    }

    return { init };
  })();

  // ============================================================================
  // WebSocket Interceptor (Anti-cheat bypass)
  // ============================================================================
  const WebSocketInterceptor = (() => {
    function isTargetURI(uri) {
      return (typeof uri === "string") && 
             uri.toLowerCase().indexOf(atob("bmlnaHRzaGFk")) !== -1;
    }

    function init() {
      const OriginalWebSocket = window.WebSocket;

      window.WebSocket = class extends EventTarget {
        constructor(uri, protocols) {
          super();
          
          this.isTarget = isTargetURI(uri);
          this.impl = new OriginalWebSocket(uri, protocols);
          
          if (this.isTarget) {
            this.startTime = Date.now();
            const timeout = CONFIG.WS_TIMEOUT_BASE_MS + 
                          Math.floor(CONFIG.WS_TIMEOUT_RANDOM_MS * Math.random());
            setTimeout(() => this.impl.close(), timeout);
          }
        }

        get binaryType() { return this.impl.binaryType; }
        set binaryType(value) { this.impl.binaryType = value; }
        get readyState() { return this.impl.readyState; }
        get url() { return this.impl.url; }
        set onopen(value) { this.impl.onopen = value; }
        set onclose(value) { this.impl.onclose = value; }
        set onmessage(value) { this.impl.onmessage = value; }
        set onerror(value) { this.impl.onerror = value; }

        close(code) {
          this.impl.close(code);
        }

        send(payload) {
          if (this.isTarget) {
            const timeSinceStart = Date.now() - this.startTime;
            const dropProbability = ((timeSinceStart / 120000) - 0.25) * 0.5;
            
            if (Math.random() < dropProbability) {
              return;
            }
          }
          this.impl.send(payload);
        }

        addEventListener(type, listener) {
          this.impl.addEventListener(type, listener);
        }

        removeEventListener(type, listener) {
          this.impl.removeEventListener(type, listener);
        }
      };
    }

    return { init };
  })();

  // ============================================================================
  // Utility Functions
  // ============================================================================
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Application Bootstrap
  // ============================================================================
  function bootstrap() {
    // Initialize interceptors
    ConsoleInterceptor.init();
    ServerConfig.init();
    WebSocketInterceptor.init();
    UserscriptManager.init();

    // Start client loader when window loads
    window.addEventListener("load", ClientLoader.run);
  }

  // Run application
  bootstrap();
})();