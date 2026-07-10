
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

        // Create pristine offscreen buffer for scan accummulation (Eliminates noise post-destruction)
        const canvasOutputPristine = document.createElement('canvas');
        canvasOutputPristine.width = CANVAS_SIZE;
        canvasOutputPristine.height = CANVAS_SIZE;
        const ctxOPristine = canvasOutputPristine.getContext('2d');

        // High-Performance Film Noise Texture Generator (Procedural offscreen tiled canvas)
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

        // Interactive States - Empty by default
        let imgState = {
            loaded: false,
            imgObj: null,
            grayscaleCanvas: null, // Offscreen canvas pre-rendered for instant grayscale (Performance Booster)
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
            speed: 2.0,
            wobble: 0,
            noise: 0,
            colorMode: 'color', // 'color' or 'bw'
            bgColor: '#ffffff',  // Default white background color
            showInfo: false      // Render parameters overlay
        };

        // Animation and Rendering States
        let frameCount = 0;
        let renderId = null; // High-efficiency requestAnimationFrame handle

        // Initialize App
        window.onload = function() {
            // Fill background with elegant solid white background
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

            // Initial render call
            triggerRender();
        };

        // Event-driven rendering trigger: schedules a render frame ONLY when actively changing
        function triggerRender() {
            if (!renderId) {
                renderId = requestAnimationFrame(renderStep);
            }
        }

        // Show interactive elegant toasts instead of alert
        function showToast(msg) {
            const toast = document.getElementById('toastMessage');
            const toastText = document.getElementById('toastText');
            toastText.textContent = msg;
            toast.classList.remove('hidden');
            toast.classList.add('flex');
            
            setTimeout(() => {
                toast.classList.remove('flex');
                toast.classList.add('hidden');
            }, 3000);
        }

        // High-performance offscreen grayscale pre-rendering
        function generateGrayscaleBuffer() {
            if (!imgState.loaded || !imgState.imgObj) return;

            imgState.grayscaleCanvas = document.createElement('canvas');
            imgState.grayscaleCanvas.width = imgState.imgObj.width;
            imgState.grayscaleCanvas.height = imgState.imgObj.height;
            const gCtx = imgState.grayscaleCanvas.getContext('2d');

            // Apply filter and draw once
            gCtx.filter = 'grayscale(100%)';
            gCtx.drawImage(imgState.imgObj, 0, 0);
            gCtx.filter = 'none';
        }

        // Load Default Image upon clicking the helper button ("image_46c448.jpg")
        function loadDefaultImage() {
            const img = new Image();
            img.onload = function() {
                imgState.imgObj = img;
                imgState.loaded = true;
                
                // Pre-calculate grayscale on load to keep tick loops blazing fast
                generateGrayscaleBuffer();
                
                // Auto fit and center on load
                transformImage('fit');
                
                // Conditionally reset scan: Only reset if scan hasn't run or is finished.
                // If 0 < scanLinePos < CANVAS_SIZE, we are paused and want to retain the scan results.
                if (scanLinePos === 0 || scanLinePos >= CANVAS_SIZE) {
                    resetScan();
                } else {
                    triggerRender();
                }
            };
            img.onerror = function() {
                showToast("未能加载测试图片，请上传本地图片。");
            };
            img.src = 'image_46c448.jpg';
        }

        // Handle raw image uploads
        function handleImageFile(file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    imgState.imgObj = img;
                    imgState.loaded = true;
                    
                    // Pre-calculate grayscale on load
                    generateGrayscaleBuffer();

                    // Auto fit and center on load
                    transformImage('fit');
                    
                    // Conditionally reset scan: Only reset if scan hasn't run or is finished.
                    // If 0 < scanLinePos < CANVAS_SIZE, we are paused and want to retain the scan results.
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
            // Mouse Interaction
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

            // Wheel Scaling
            canvasInteractive.addEventListener('wheel', (e) => {
                if (!imgState.loaded) return;
                e.preventDefault();
                const scaleAmount = -e.deltaY * 0.0015;
                imgState.scale = Math.max(0.1, Math.min(6, imgState.scale + scaleAmount));
                triggerRender();
            }, { passive: false });

            // Touch interaction (Mobile Support)
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

        // Adjust placement matrix and auto-adapt to workspace size perfectly
        function transformImage(action) {
            if (!imgState.loaded) return;

            if (action === 'center') {
                imgState.x = CANVAS_SIZE / 2;
                imgState.y = CANVAS_SIZE / 2;
                imgState.rotation = 0;
                imgState.scale = 1;
            } else if (action === 'rotate90') {
                imgState.rotation = (imgState.rotation + Math.PI / 2) % (Math.PI * 2);
            } else if (action === 'fit') {
                const scaleW = CANVAS_SIZE / imgState.imgObj.width;
                const scaleH = CANVAS_SIZE / imgState.imgObj.height;
                // Auto adapt size perfectly to workspace container with slight margin padding
                imgState.scale = Math.min(scaleW, scaleH) * 0.95;
                imgState.x = CANVAS_SIZE / 2;
                imgState.y = CANVAS_SIZE / 2;
                imgState.rotation = 0;
            }
            triggerRender();
        }

        // Update parameters from sliders
        function updateParam(param) {
            const inputVal = parseFloat(document.getElementById(`param${param}`).value);
            if (param === 'Speed') {
                settings.speed = inputVal;
                document.getElementById('valSpeed').innerText = `${inputVal.toFixed(1)} 像素/帧`;
            } else if (param === 'Wobble') {
                settings.wobble = inputVal;
                document.getElementById('valWobble').innerText = `${inputVal.toFixed(1)} px`;
            } else if (param === 'Noise') {
                settings.noise = inputVal;
                document.getElementById('valNoise').innerText = `${Math.floor(inputVal)}%`;
            }
            triggerRender();
        }

        // Update Background Color dynamically and instantly without affecting foreground pixels
        function updateBgColor(val) {
            settings.bgColor = val;
            document.getElementById('valBgColor').innerText = val.toUpperCase();
            
            // Instantly apply the background color style to HTML Canvas containers
            // We draw the color inside canvasOutput, so we only need to style canvasInteractive
            canvasInteractive.style.backgroundColor = val;
            
            triggerRender();
        }

        // Set Scanning Directions
        function setDirection(dir) {
            scanDirection = dir;
            
            document.querySelectorAll('.dir-btn').forEach(btn => {
                btn.className = "dir-btn py-1.5 text-[10px] font-semibold rounded-lg border bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300 transition-all";
            });
            
            const activeBtn = document.getElementById(`dirBtn${dir}`);
            activeBtn.className = "dir-btn py-1.5 text-[10px] font-semibold rounded-lg border bg-emerald-500/10 border-emerald-500/50 text-emerald-300 transition-all";
            
            resetScan();
        }

        // Toggle Color vs Black & White
        function setColorMode(mode) {
            settings.colorMode = mode;

            document.querySelectorAll('.color-mode-btn').forEach(btn => {
                btn.className = "color-mode-btn py-1 text-[10px] font-semibold rounded-lg border bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-300 transition-all";
            });

            const activeBtn = (mode === 'color') ? document.getElementById('colorModeBtnColor') : document.getElementById('colorModeBtnBW');
            activeBtn.className = "color-mode-btn py-1 text-[10px] font-semibold rounded-lg border bg-emerald-500/10 border-emerald-500/50 text-emerald-300 transition-all";

            // If Mono selected, instantly convert existing accumulated pristine canvas to grayscale
            if (mode === 'bw') {
                applyGrayscaleToOutput();
            } else {
                // If switching back to color, we rely on the pristine scans accumulated so far
                triggerRender();
            }
        }

        // High quality offscreen mono converter
        function applyGrayscaleToOutput() {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = CANVAS_SIZE;
            tempCanvas.height = CANVAS_SIZE;
            const tempCtx = tempCanvas.getContext('2d');
            
            tempCtx.filter = 'grayscale(100%)';
            tempCtx.drawImage(canvasOutputPristine, 0, 0);
            
            ctxOPristine.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            ctxOPristine.drawImage(tempCanvas, 0, 0);
        }

        // Toggle Parameter Overlay Rendering
        function toggleShowInfo() {
            settings.showInfo = paramShowInfo.checked;
            triggerRender();
        }

        function clearOutputFilm() {
            // Keep output and pristine offscreen canvases fully transparent to support seamless CSS color changes
            ctxOPristine.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            ctxO.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            
            triggerRender();
        }

        // Play Pause Mechanism
        function toggleScan() {
            if (!imgState.loaded) {
                showToast("请先在 A 操控台上传或粘贴一张图片后再进行扫描！");
                return;
            }

            isScanning = !isScanning;
            if (isScanning) {
                playIcon.className = "fa-solid fa-pause";
                playText.innerText = "暂停扫描";
                
                // Auto reset position to start if scanner was at the end of canvas
                if (scanLinePos >= CANVAS_SIZE) {
                    clearOutputFilm();
                    scanLinePos = 0;
                }
            } else {
                playIcon.className = "fa-solid fa-play";
                playText.innerText = "继续扫描";
            }
            triggerRender();
        }

        function resetScan() {
            scanLinePos = 0;
            clearOutputFilm();
            
            isScanning = false;
            playIcon.className = "fa-solid fa-play";
            playText.innerText = "开始扫描";
            triggerRender();
        }

        // Main Animation Step (Invoked on-demand)
        function renderStep() {
            renderId = null; // Clear key so next frame can schedule
            frameCount++;

            // 1. Apply dynamic sine wave displacements if Wobble is on
            processAutomation();

            // 2. Render Workspace A CLEANly (without grid/laser for perfect slicing)
            renderInteractiveCanvas();

            // 3. Slit Scan rendering projection to offscreen Pristine Canvas (Anti-aliased)
            processSlitScan();

            // 4. Render the cumulative scanning result with post-process effects (e.g. Grayscale & Noise)
            renderOutputCanvasWithPostProcess();

            // 5. Draw overlays (laser lines and interactive guides) onto Workspace A for display
            renderInteractiveOverlays();

            // Keep loop active ONLY if something is actively changing (saving resources)
            if (isScanning || imgState.isDragging) {
                triggerRender();
            }
        }

        // Handle automated sin wobbles
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

        // Render Workspace Panel - Pure Image Pass
        function renderInteractiveCanvas() {
            // Keep workspace canvas background transparent to let CSS bg-color show through
            ctxI.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

            if (imgState.loaded && imgState.imgObj) {
                ctxI.save();
                ctxI.translate(imgState.x, imgState.y);
                ctxI.rotate(imgState.rotation);
                
                const w = imgState.imgObj.width * imgState.scale;
                const h = imgState.imgObj.height * imgState.scale;
                
                // High Quality rendering settings for clean anti-aliasing (Anti-Jagged edges)
                ctxI.imageSmoothingEnabled = true;
                ctxI.imageSmoothingQuality = 'high';

                // Render either the pre-rendered Grayscale buffer or standard color image
                const activeSource = (settings.colorMode === 'bw' && imgState.grayscaleCanvas) 
                    ? imgState.grayscaleCanvas 
                    : imgState.imgObj;

                ctxI.drawImage(activeSource, -w / 2, -h / 2, w, h);
                ctxI.restore();
            } else {
                // When no image is loaded, draw a gorgeous cyberpunk empty placeholder
                ctxI.save();
                ctxI.textAlign = 'center';
                ctxI.textBaseline = 'middle';
                
                // Draw dashed outline
                ctxI.strokeStyle = 'rgba(16, 185, 129, 0.2)';
                ctxI.lineWidth = 2;
                ctxI.setLineDash([10, 10]);
                ctxI.strokeRect(40, 40, CANVAS_SIZE - 80, CANVAS_SIZE - 80);
                
                // Instructions Text
                ctxI.fillStyle = '#64748b';
                ctxI.font = '22px "Inter", sans-serif';
                ctxI.fillText("等待载入艺术源文件...", CANVAS_SIZE / 2, CANVAS_SIZE / 2 - 20);
                
                ctxI.fillStyle = '#475569';
                ctxI.font = '14px "Inter", sans-serif';
                ctxI.fillText("点击下方上传、拖拽至此、或者按 Ctrl+V 直接粘贴图片", CANVAS_SIZE / 2, CANVAS_SIZE / 2 + 20);
                ctxI.restore();
            }
        }

        // Draw Interactive Guide UI Overlays on Workspace Canvas AFTER capturing slice
        function renderInteractiveOverlays() {
            // Subtle grid in Workspace background - OPTIMIZED: Batched paths to 1 drawcall instead of 40+
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

            // Only show glowing scanner laser line if image has been loaded
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

        // Accumulate scanned slices onto B Film canvas (Anti-aliased, zero-stutter)
        function processSlitScan() {
            if (!isScanning || !imgState.loaded) return;

            const currentSpeed = settings.speed;
            const startPos = scanLinePos;
            const endPos = scanLinePos + currentSpeed;
            
            // Sub-pixel precise sampling with micro-overlap (0.5px) to prevent sub-pixel white scanline gaps
            const overlap = 0.5;

            if (endPos > startPos && startPos < CANVAS_SIZE) {
                ctxOPristine.save();
                
                // Keep image smoothing enabled to guarantee smooth, non-pixelated/non-jagged edges
                ctxOPristine.imageSmoothingEnabled = true;
                ctxOPristine.imageSmoothingQuality = 'high';

                if (scanDirection === 'Y') {
                    ctxOPristine.drawImage(
                        canvasInteractive, 
                        0, startPos, CANVAS_SIZE, (endPos - startPos) + overlap, // Source slice
                        0, startPos, CANVAS_SIZE, (endPos - startPos) + overlap  // Target slice on film output
                    );
                } else {
                    ctxOPristine.drawImage(
                        canvasInteractive, 
                        startPos, 0, (endPos - startPos) + overlap, CANVAS_SIZE, // Source slice
                        startPos, 0, (endPos - startPos) + overlap, CANVAS_SIZE  // Target slice on film output
                    );
                }
                ctxOPristine.restore();
            }

            // Move the scanner bar
            scanLinePos += currentSpeed;

            // Stop when single-pass is finished
            if (scanLinePos >= CANVAS_SIZE) {
                isScanning = false;
                playIcon.className = "fa-solid fa-play";
                playText.innerText = "开始扫描";
                triggerRender();
            }
        }

        // Render the visible B canvas combining background, transparent pristine scans, noise & text parameters
        function renderOutputCanvasWithPostProcess() {
            ctxO.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
            
            // 1. Fill solid background color directly onto canvas. 
            // This guarantees preview color blending is 100% identical to final export.
            ctxO.fillStyle = settings.bgColor;
            ctxO.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

            // 2. Draw accumulated pristine scanned images (100% smooth, anti-aliased)
            ctxO.drawImage(canvasOutputPristine, 0, 0);
            
            // 3. Apply adjustable dynamic noise overlay on top of solid background + image
            if (settings.noise > 0) {
                ctxO.save();
                // Map noise value 0-100 to 0.0 - 0.45 opacity for an aesthetic film grain look
                ctxO.globalAlpha = (settings.noise / 100) * 0.45;
                ctxO.globalCompositeOperation = 'overlay'; // Elegant analog film noise blending
                
                const pattern = ctxO.createPattern(noiseCanvas, 'repeat');
                ctxO.fillStyle = pattern;
                ctxO.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
                ctxO.restore();
            }

            // 4. Render the 8px Monospace Parameter Overlay if enabled
            if (settings.showInfo) {
                ctxO.save();
                ctxO.fillStyle = '#000000'; // Pure black text
                ctxO.font = '12px monospace';
                ctxO.textAlign = 'left';
                ctxO.textBaseline = 'bottom';
                
                // Pure English stats from Modules 2, 3, 4
                const lines = [
                    `${scanDirection === 'Y' ? 'VERTICAL' : 'HORIZONTAL'}`,
                    `${settings.speed.toFixed(1)} PX/FRAME`,
                    `${settings.colorMode === 'bw' ? 'MONO (B&W)' : 'COLOR'}`,
                    `NOISE ${Math.floor(settings.noise)}%`,
                ];
                
                const startX = 20;
                const startY = CANVAS_SIZE - 15;
                const fontSize = 15; // Line spacing equal to font size (1x line-height)

                // Render lines from bottom to top (last element of array on bottom-most position)
                for (let i = 0; i < lines.length; i++) {
                    const lineIndex = lines.length - 1 - i;
                    ctxO.fillText(lines[lineIndex], startX, startY - (i * fontSize));
                }
                ctxO.restore();
            }
        }

        // Export masterpiece with baked background and noise
        function downloadMasterpiece() {
            if (!imgState.loaded) {
                showToast("没有可导出的扫描结果，请先载入图片并进行一次扫描！");
                return;
            }
            
            // Output canvas is already perfectly rendered with background, image slices, noise & text
            const link = document.createElement('a');
            link.download = `scanner_distortion_art_${Date.now()}.png`;
            link.href = canvasOutput.toDataURL("image/png");
            link.click();
        }
