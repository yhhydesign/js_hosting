
        const canvasInteractive = document.getElementById('canvasInteractive');
        const canvasOutput = document.getElementById('canvasOutput');
        const ctxI = canvasInteractive.getContext('2d');
        const ctxO = canvasOutput.getContext('2d');
        const imageLoader = document.getElementById('imageLoader');
        const btnPlayPause = document.getElementById('btnPlayPause');
        const playIcon = document.getElementById('playIcon');
        const playText = document.getElementById('playText');
        
        // Params inputs
        const paramSpeed = document.getElementById('paramSpeed');
        const paramWobble = document.getElementById('paramWobble');
        const paramNoise = document.getElementById('paramNoise');
        const paramShowInfo = document.getElementById('paramShowInfo');

        // Setup dimensions - 800 for high density and maximum crispness
        const CANVAS_SIZE = 800;
        canvasInteractive.width = CANVAS_SIZE;
        canvasInteractive.height = CANVAS_SIZE;
        canvasOutput.width = CANVAS_SIZE;
        canvasOutput.height = CANVAS_SIZE;

        // Create pristine offscreen buffer for scan accumulation
        const canvasOutputPristine = document.createElement('canvas');
        canvasOutputPristine.width = CANVAS_SIZE;
        canvasOutputPristine.height = CANVAS_SIZE;
        const ctxOPristine = canvasOutputPristine.getContext('2d');

        // High-Performance Film Noise Texture Generator
        const noiseCanvas = document.createElement('canvas');
        noiseCanvas.width = 128;
        noiseCanvas.height = 128;
        const noiseCtx = noiseCanvas.getContext('2d');
        const noiseImgData = noiseCtx.createImageData(128, 128);
        for (let i = 0; i < noiseImgData.data.length; i += 4) {
            const val = Math.floor(Math.random() * 255);
            noiseImgData.data[i] = val;     // R
            noiseImgData.data[i+1] = val;   // G
            noiseImgData.data[i+2] = val;   // B
            noiseImgData.data[i+3] = 255;   // A
        }
        noiseCtx.putImageData(noiseImgData, 0, 0);

        // Internationalization Map
        const i18n = {
            en: {
                title: "SCANNER DISTORTION LAB",
                subtitle: "Slit-Scan Glitch Art • Scanner Displacement Generator",
                workspaceA: "A. WORKSPACE",
                workspaceASub: "Drag to move • Scroll to zoom",
                controlTip: "Drag to move • Scroll to zoom",
                pressR: "Press R to reset",
                rotate90: "Rotate 90°",
                workspaceB: "B. SCANNING RESULT",
                workspaceBSub: "Pristine High-Res Output",
                clearFilm: "Clear Film",
                exportArt: "Export Artwork",
                uploadTitle: "1. SOURCE IMAGE",
                uploadBtn: "Upload Image or Paste",
                paramTitle: "2. PARAMETERS & DIRECTION",
                speedLabel: "Scan Speed",
                speedUnit: "px/frame",
                dirLabel: "Scan Direction",
                dirY: "Vertical (Y)",
                dirX: "Horizontal (X)",
                effectsTitle: "3. COLOR, NOISE & WOBBLE",
                colorBtn: "Color",
                monoBtn: "Mono",
                bgColorLabel: "Background Color",
                noiseLabel: "Noise Grain",
                wobbleLabel: "Sine Wobble Displacement",
                showInfoLabel: "Show Parameter Info",
                controlTitle: "4. Start Scan",
                startScan: "Start Scan",
                pauseScan: "Pause Scan",
                continueScan: "Continue Scan",
                resetScan: "Reset Scan",
                toastNoImg: "Please upload or paste an image first!",
                emptyPlaceholderTitle: "Waiting for source image...",
                emptyPlaceholderSub: "Click above to upload, drag here, or press Ctrl+V to paste"
            },
            zh: {
                title: "扫描仪位移故障艺术生成器",
                subtitle: "Slit-Scan Glitch Art • 扫描位移故障艺术生成器",
                workspaceA: "A. 互动操控台 (WORKSPACE)",
                workspaceASub: "拖拽移动图像 • 滚轮缩放",
                controlTip: "拖拽移动 • 滚轮缩放",
                pressR: "R 键重置",
                rotate90: "旋转 90°",
                workspaceB: "B. 扫描结果 (SCANNING RESULT)",
                workspaceBSub: "超清无杂质输出",
                clearFilm: "擦除底片",
                exportArt: "导出作品",
                uploadTitle: "1. 输入源图像",
                uploadBtn: "上传图片或剪贴板粘贴",
                paramTitle: "2. 扫描参数与方向",
                speedLabel: "扫描速度",
                speedUnit: "像素/帧",
                dirLabel: "扫描方向",
                dirY: "纵向 (Y)",
                dirX: "横向 (X)",
                effectsTitle: "3. 色彩、噪点与抖动",
                colorBtn: "彩色",
                monoBtn: "黑白",
                bgColorLabel: "底片背景色",
                noiseLabel: "噪点颗粒度",
                wobbleLabel: "正弦自动波形抖动",
                showInfoLabel: "显示参数信息 (Info)",
                controlTitle: "4. 扫描执行",
                startScan: "开始扫描",
                pauseScan: "暂停扫描",
                continueScan: "继续扫描",
                resetScan: "重置扫描",
                toastNoImg: "请先在 A 操控台上传或粘贴一张图片后再进行扫描！",
                emptyPlaceholderTitle: "等待载入艺术源文件...",
                emptyPlaceholderSub: "点击上方上传、拖拽至此、或者按 Ctrl+V 直接粘贴图片"
            }
        };

        let currentLang = 'en';

        // Interactive States - Empty by default
        let imgState = {
            loaded: false,
            imgObj: null,
            x: CANVAS_SIZE / 2,
            y: CANVAS_SIZE / 2,
            scale: 1,
            rotation: 0, // Radians
            isDragging: false,
            dragStart: { x: 0, y: 0 },
            dragOffset: { x: 0, y: 0 }
        };

        // Scanner Engine Variables
        let isScanning = false;
        let scanLinePos = 0; // Current scanning coordinate
        let scanDirection = 'Y'; // 'Y' (Top to bottom), 'X' (Left to right)
        let settings = {
            speed: 1.0,      // New Default: 1.0
            wobble: 0,
            noise: 40,       // New Default: 40
            colorMode: 'color', // 'color' or 'bw'
            bgColor: '#ffffff',  // Default white background color
            showInfo: true       // New Default: true
        };

        // Animation and Rendering States
        let frameCount = 0;
        let renderId = null;

        // Initialize App
        window.onload = function() {
            clearOutputFilm();
            
            // Setup mouse & touch listeners
            setupCanvasInteraction();

            // Keyboard Hooks
            window.addEventListener('keydown', (e) => {
                if (e.key === 'r' || e.key === 'R') {
                    transformImage('fit');
                }
            });

            // Drag-and-drop handles
            const dropZone = document.getElementById('interactiveContainer');
            dropZone.addEventListener('dragover', (e) => { e.preventDefault(); });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleImageFile(e.dataTransfer.files[0]);
                }
            });

            // Register Paste events globally
            window.addEventListener('paste', (e) => {
                const items = (e.clipboardData || e.originalEvent.clipboardData).items;
                for (let index in items) {
                    const item = items[index];
                    if (item.kind === 'file') {
                        const blob = item.getAsFile();
                        handleImageFile(blob);
                        break;
                    }
                }
            });

            imageLoader.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    handleImageFile(e.target.files[0]);
                }
            });

            // Initialize Language and default states
            updateLanguageUI();
            triggerRender();
        };

        // Language Switcher Function
        function toggleLanguage() {
            currentLang = (currentLang === 'en') ? 'zh' : 'en';
            document.getElementById('langBtnText').innerText = (currentLang === 'en') ? 'English' : '中文';
            updateLanguageUI();
        }

        function updateLanguageUI() {
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                if (i18n[currentLang][key]) {
                    el.innerText = i18n[currentLang][key];
                }
            });
            updateSpeedUI();
            updateNoiseUI();
            updateWobbleUI();
            updatePlayBtnUI();
            triggerRender();
        }

        // Event-driven rendering trigger
        function triggerRender() {
            if (!renderId) {
                renderId = requestAnimationFrame(renderStep);
            }
        }

        // Toast Messages
        function showToast(msgKey) {
            const toast = document.getElementById('toastMessage');
            const toastText = document.getElementById('toastText');
            toastText.textContent = i18n[currentLang][msgKey] || msgKey;
            toast.classList.remove('hidden');
            toast.classList.add('flex');
            
            setTimeout(() => {
                toast.classList.remove('flex');
                toast.classList.add('hidden');
            }, 3000);
        }

        // Handle raw image uploads
        function handleImageFile(file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    imgState.imgObj = img;
                    imgState.loaded = true;
                    
                    transformImage('fit');
                    
                    if (scanLinePos === 0 || scanLinePos >= CANVAS_SIZE) {
                        resetScan();
                    } else {
                        triggerRender();
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }

        // Workspace Interaction Mechanics
        function setupCanvasInteraction() {
            canvasInteractive.addEventListener('mousedown', (e) => {
                if (!imgState.loaded) return;
                const rect = canvasInteractive.getBoundingClientRect();
                const mX = (e.clientX - rect.left) * (CANVAS_SIZE / rect.width);
                const mY = (e.clientY - rect.top) * (CANVAS_SIZE / rect.height);
                
                imgState.isDragging = true;
                imgState.dragStart.x = mX;
                imgState.dragStart.y = mY;
                imgState.dragOffset.x = imgState.x;
                imgState.dragOffset.y = imgState.y;
                triggerRender();
            });

            window.addEventListener('mousemove', (e) => {
                if (!imgState.isDragging || !imgState.loaded) return;
                
                const rect = canvasInteractive.getBoundingClientRect();
                const mX = (e.clientX - rect.left) * (CANVAS_SIZE / rect.width);
                const mY = (e.clientY - rect.top) * (CANVAS_SIZE / rect.height);

                const dx = mX - imgState.dragStart.x;
                const dy = mY - imgState.dragStart.y;

                imgState.x = imgState.dragOffset.x + dx;
                imgState.y = imgState.dragOffset.y + dy;
                triggerRender();
            });

            window.addEventListener('mouseup', () => {
                if (imgState.isDragging) {
                    imgState.isDragging = false;
                    triggerRender();
                }
            });

            canvasInteractive.addEventListener('wheel', (e) => {
                if (!imgState.loaded) return;
                e.preventDefault();
                const scaleAmount = -e.deltaY * 0.0015;
                imgState.scale = Math.max(0.1, Math.min(6, imgState.scale + scaleAmount));
                triggerRender();
            }, { passive: false });

            // Touch support
            canvasInteractive.addEventListener('touchstart', (e) => {
                if (!imgState.loaded) return;
                if (e.touches.length === 1) {
                    const rect = canvasInteractive.getBoundingClientRect();
                    const touch = e.touches[0];
                    const tX = (touch.clientX - rect.left) * (CANVAS_SIZE / rect.width);
                    const tY = (touch.clientY - rect.top) * (CANVAS_SIZE / rect.height);
                    
                    imgState.isDragging = true;
                    imgState.dragStart.x = tX;
                    imgState.dragStart.y = tY;
                    imgState.dragOffset.x = imgState.x;
                    imgState.dragOffset.y = imgState.y;
                    triggerRender();
                }
            });

            canvasInteractive.addEventListener('touchmove', (e) => {
                if (!imgState.isDragging || e.touches.length !== 1 || !imgState.loaded) return;
                e.preventDefault();
                
                const rect = canvasInteractive.getBoundingClientRect();
                const touch = e.touches[0];
                const tX = (touch.clientX - rect.left) * (CANVAS_SIZE / rect.width);
                const tY = (touch.clientY - rect.top) * (CANVAS_SIZE / rect.height);

                const dx = tX - imgState.dragStart.x;
                const dy = tY - imgState.dragStart.y;

                imgState.x = imgState.dragOffset.x + dx;
                imgState.y = imgState.dragOffset.y + dy;
                triggerRender();
            }, { passive: false });

            canvasInteractive.addEventListener('touchend', () => {
                if (imgState.isDragging) {
                    imgState.isDragging = false;
                    triggerRender();
                }
            });
        }

        function transformImage(action) {
            if (!imgState.loaded) return;

            if (action === 'rotate90') {
                imgState.rotation = (imgState.rotation + Math.PI / 2) % (Math.PI * 2);
            } else if (action === 'fit') {
                const scaleW = CANVAS_SIZE / imgState.imgObj.width;
                const scaleH = CANVAS_SIZE / imgState.imgObj.height;
                imgState.scale = Math.min(scaleW, scaleH) * 0.95;
                imgState.x = CANVAS_SIZE / 2;
                imgState.y = CANVAS_SIZE / 2;
                imgState.rotation = 0;
            }
            triggerRender();
        }

        // Update UI dynamic readouts
        function updateSpeedUI() {
            const unit = i18n[currentLang].speedUnit;
            document.getElementById('valSpeed').innerText = `${settings.speed.toFixed(1)} ${unit}`;
        }
        function updateNoiseUI() {
            document.getElementById('valNoise').innerText = `${Math.floor(settings.noise)}%`;
        }
        function updateWobbleUI() {
            document.getElementById('valWobble').innerText = `${settings.wobble.toFixed(1)} px`;
        }

        // Update parameters from sliders
        function updateParam(param) {
            const inputVal = parseFloat(document.getElementById(`param${param}`).value);
            if (param === 'Speed') {
                settings.speed = inputVal;
                updateSpeedUI();
            } else if (param === 'Wobble') {
                settings.wobble = inputVal;
                updateWobbleUI();
            } else if (param === 'Noise') {
                settings.noise = inputVal;
                updateNoiseUI();
            }
            triggerRender();
        }

        function updateBgColor(val) {
            settings.bgColor = val;
            document.getElementById('valBgColor').innerText = val.toUpperCase();
            canvasInteractive.style.backgroundColor = val;
            triggerRender();
        }

        function setDirection(dir) {
            scanDirection = dir;
            
            document.querySelectorAll('.dir-btn').forEach(btn => {
                btn.className = "dir-btn py-1 text-[10px] font-semibold rounded-lg border bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300 transition-all";
            });
            
            const activeBtn = document.getElementById(`dirBtn${dir}`);
            activeBtn.className = "dir-btn py-1 text-[10px] font-semibold rounded-lg border bg-emerald-500/10 border-emerald-500/50 text-emerald-300 transition-all";
            
            resetScan();
        }

        // Seamless non-destructive grayscale/color toggler
        function setColorMode(mode) {
            settings.colorMode = mode;

            document.querySelectorAll('.color-mode-btn').forEach(btn => {
                btn.className = "color-mode-btn py-1 text-[10px] font-semibold rounded-lg border bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300 transition-all";
            });

            const activeBtn = (mode === 'color') ? document.getElementById('colorModeBtnColor') : document.getElementById('colorModeBtnBW');
            activeBtn.className = "color-mode-btn py-1 text-[10px] font-semibold rounded-lg border bg-emerald-500/10 border-emerald-500/50 text-emerald-300 transition-all";

            // GPU Accelerated Visual Toggling for Interactive Canvas A (Zero Lag)
            canvasInteractive.style.filter = (mode === 'bw') ? 'grayscale(100%)' : 'none';

            // Triggers redraw in Output Canvas with dynamic 2D context filter integration
            triggerRender();
        }

        function toggleShowInfo() {
            settings.showInfo = paramShowInfo.checked;
            triggerRender();
        }

        function clearOutputFilm() {
            ctxOPristine.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            ctxO.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            triggerRender();
        }

        function updatePlayBtnUI() {
            if (isScanning) {
                playIcon.className = "fa-solid fa-pause";
                playText.innerText = i18n[currentLang].pauseScan;
            } else {
                playIcon.className = "fa-solid fa-play";
                playText.innerText = scanLinePos > 0 && scanLinePos < CANVAS_SIZE 
                    ? i18n[currentLang].continueScan 
                    : i18n[currentLang].startScan;
            }
        }

        function toggleScan() {
            if (!imgState.loaded) {
                showToast("toastNoImg");
                return;
            }

            isScanning = !isScanning;
            if (isScanning) {
                if (scanLinePos >= CANVAS_SIZE) {
                    clearOutputFilm();
                    scanLinePos = 0;
                }
            }
            updatePlayBtnUI();
            triggerRender();
        }

        function resetScan() {
            scanLinePos = 0;
            clearOutputFilm();
            
            isScanning = false;
            updatePlayBtnUI();
            triggerRender();
        }

        // Render Step
        function renderStep() {
            renderId = null;
            frameCount++;

            // 1. Process automated wave motion
            processAutomation();

            // 2. Render Workspace A
            renderInteractiveCanvas();

            // 3. Process the Slit-scan onto cumulative buffer (Always color)
            processSlitScan();

            // 4. Render the visible output (Injects colorMode filter & noise dynamically)
            renderOutputCanvasWithPostProcess();

            // 5. Drawing guidelines and laser
            renderInteractiveOverlays();

            if (isScanning || imgState.isDragging) {
                triggerRender();
            }
        }

        function processAutomation() {
            if (imgState.loaded && isScanning && settings.wobble > 0) {
                const waveOffset = Math.sin(frameCount * 0.12) * (settings.wobble * 0.15);
                if (scanDirection === 'Y') {
                    imgState.x += waveOffset;
                } else {
                    imgState.y += waveOffset;
                }
            }
        }

        function renderInteractiveCanvas() {
            ctxI.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

            if (imgState.loaded && imgState.imgObj) {
                ctxI.save();
                ctxI.translate(imgState.x, imgState.y);
                ctxI.rotate(imgState.rotation);
                
                const w = imgState.imgObj.width * imgState.scale;
                const h = imgState.imgObj.height * imgState.scale;
                
                ctxI.imageSmoothingEnabled = true;
                ctxI.imageSmoothingQuality = 'high';

                ctxI.drawImage(imgState.imgObj, -w / 2, -h / 2, w, h);
                ctxI.restore();
            } else {
                ctxI.save();
                ctxI.textAlign = 'center';
                ctxI.textBaseline = 'middle';
                
                ctxI.strokeStyle = 'rgba(16, 185, 129, 0.2)';
                ctxI.lineWidth = 2;
                ctxI.setLineDash([10, 10]);
                ctxI.strokeRect(40, 40, CANVAS_SIZE - 80, CANVAS_SIZE - 80);
                
                ctxI.fillStyle = '#64748b';
                ctxI.font = '20px "Inter", sans-serif';
                ctxI.fillText(i18n[currentLang].emptyPlaceholderTitle, CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 15);
                
                ctxI.fillStyle = '#475569';
                ctxI.font = '12px "Inter", sans-serif';
                ctxI.fillText(i18n[currentLang].emptyPlaceholderSub, CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 20);
                ctxI.restore();
            }
        }

        function renderInteractiveOverlays() {
            ctxI.save();
            ctxI.strokeStyle = 'rgba(30, 41, 59, 0.6)';
            ctxI.lineWidth = 0.5;
            ctxI.beginPath();
            for (let i = 0; i < CANVAS_SIZE; i += 40) {
                ctxI.moveTo(i, 0); ctxI.lineTo(i, CANVAS_SIZE);
                ctxI.moveTo(0, i); ctxI.lineTo(CANVAS_SIZE, i);
            }
            ctxI.stroke();
            ctxI.restore();

            if (imgState.loaded) {
                ctxI.save();
                ctxI.strokeStyle = '#10b981';
                ctxI.shadowColor = '#10b981';
                
                if (isScanning) {
                    ctxI.shadowBlur = 10;
                    ctxI.lineWidth = 2.5;
                } else {
                    ctxI.shadowBlur = 4;
                    ctxI.lineWidth = 1;
                }
                
                ctxI.beginPath();
                if (scanDirection === 'Y') {
                    ctxI.moveTo(0, scanLinePos);
                    ctxI.lineTo(CANVAS_SIZE, scanLinePos);
                } else {
                    ctxI.moveTo(scanLinePos, 0);
                    ctxI.lineTo(scanLinePos, CANVAS_SIZE);
                }
                ctxI.stroke();
                ctxI.restore();
            }
        }

        function processSlitScan() {
            if (!isScanning || !imgState.loaded) return;

            const currentSpeed = settings.speed;
            const startPos = scanLinePos;
            const endPos = scanLinePos + currentSpeed;
            const overlap = 0.5;

            if (endPos > startPos && startPos < CANVAS_SIZE) {
                ctxOPristine.save();
                ctxOPristine.imageSmoothingEnabled = true;
                ctxOPristine.imageSmoothingQuality = 'high';

                if (scanDirection === 'Y') {
                    ctxOPristine.drawImage(
                        canvasInteractive, 
                        0, startPos, CANVAS_SIZE, (endPos - startPos) + overlap,
                        0, startPos, CANVAS_SIZE, (endPos - startPos) + overlap
                    );
                } else {
                    ctxOPristine.drawImage(
                        canvasInteractive, 
                        startPos, 0, (endPos - startPos) + overlap, CANVAS_SIZE,
                        startPos, 0, (endPos - startPos) + overlap, CANVAS_SIZE
                    );
                }
                ctxOPristine.restore();
            }

            scanLinePos += currentSpeed;

            if (scanLinePos >= CANVAS_SIZE) {
                isScanning = false;
                updatePlayBtnUI();
                triggerRender();
            }
        }

        function renderOutputCanvasWithPostProcess() {
            ctxO.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            
            ctxO.save();
            // Integrated Non-destructive filter hook - transforms render on the fly seamlessly
            if (settings.colorMode === 'bw') {
                ctxO.filter = 'grayscale(100%)';
            } else {
                ctxO.filter = 'none';
            }

            // 1. Solid Film Base Color
            ctxO.fillStyle = settings.bgColor;
            ctxO.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

            // 2. Draw pristine colors
            ctxO.drawImage(canvasOutputPristine, 0, 0);
            ctxO.restore();
            
            // 3. Film Grain
            if (settings.noise > 0) {
                ctxO.save();
                ctxO.globalAlpha = (settings.noise / 100) * 0.45;
                ctxO.globalCompositeOperation = 'overlay';
                
                const pattern = ctxO.createPattern(noiseCanvas, 'repeat');
                ctxO.fillStyle = pattern;
                ctxO.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
                ctxO.restore();
            }

            // 4. Overlay metadata HUD
            if (settings.showInfo) {
                ctxO.save();
                ctxO.fillStyle = '#000000';
                ctxO.font = '12px monospace';
                ctxO.textAlign = 'left';
                ctxO.textBaseline = 'bottom';
                
                const lines = [
                    `${scanDirection === 'Y' ? 'VERTICAL' : 'HORIZONTAL'}`,
                    `${settings.speed.toFixed(1)} PX/FRAME`,
                    `${settings.colorMode === 'bw' ? 'MONO (B&W)' : 'COLOR'}`,
                    `NOISE ${Math.floor(settings.noise)}%`,
                ];
                
                const startX = 20;
                const startY = CANVAS_SIZE - 15;
                const fontSize = 15;

                for (let i = 0; i < lines.length; i++) {
                    const lineIndex = lines.length - 1 - i;
                    ctxO.fillText(lines[lineIndex], startX, startY - (i * fontSize));
                }
                ctxO.restore();
            }
        }

        function downloadMasterpiece() {
            if (!imgState.loaded) {
                showToast("toastNoImg");
                return;
            }
            
            const link = document.createElement('a');
            link.download = `scanner_distortion_art_${Date.now()}.png`;
            link.href = canvasOutput.toDataURL("image/png");
            link.click();
        }
