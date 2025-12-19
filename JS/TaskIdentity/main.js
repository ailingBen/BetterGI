(async function () {
    //定义RecognitionArea类,存放识别区域坐标
    class RecognitionArea {
        static X = 875;
        static Y = 235;
        static Width = 895;
        static Height = 60;
    }
    
    // 文件追加内容
    async function fileReadWrite(filePath, content, fileName) {
        try {
            const success = file.writeTextSync(filePath, content,true);
            if (success) {
                log.info(`${fileName}已保存`);
                return true;
            } else {
                log.error(`${fileName}保存失败`);
                return false;
            }
        } catch (error) {
            log.error(`${fileName}保存失败: ${error}`);
            return false;
        }
    }

    // 显示识别区域
    async function showRecognitionArea() {
        try {
            // 捕获整个游戏区域
            const gameCaptureRegion = captureGameRegion({
                X: 0,
                Y: 0,
                Width: genshin.width,
                Height: genshin.height
            });

            // 绘制红框
            let drawRegion = gameCaptureRegion.DeriveCrop(
                RecognitionArea.X, 
                RecognitionArea.Y, 
                RecognitionArea.Width, 
                RecognitionArea.Height).DrawSelf("icon");

            // 延时
            await sleep(2000);

            // 清除红框
            if (drawRegion) {
                let drawRegion2 = gameCaptureRegion.DeriveCrop(0, 0, 0, 0);
                drawRegion2.DrawSelf("icon");
                drawRegion2.dispose(); // 释放对象
            }
            
            // 显示图像尺寸和识别区域信息
            const imageInfo = `图像尺寸: ${genshin.width}x${genshin.height}
识别区域: X=${RecognitionArea.X}, Y=${RecognitionArea.Y}, W=${RecognitionArea.Width}, H=${RecognitionArea.Height}
区域比例: X=${(RecognitionArea.X/genshin.width*100).toFixed(1)}%, Y=${(RecognitionArea.Y/genshin.height*100).toFixed(1)}%`;

            log.info(imageInfo);
            
            // 释放资源
            gameCaptureRegion.dispose();

        } catch (error) {
            log.error(`显示识别区域失败: ${error.message}`);
            return null;
        }
    }

    // OCR识别函数
    async function recognizeImage(timeout = 5000) {
        let startTime = Date.now();
        let attemptCount = 0;

        log.info(`识别区域: X=${RecognitionArea.X}, Y=${RecognitionArea.Y}, 宽度=${RecognitionArea.Width}, 高度=${RecognitionArea.Height}`);

        while (Date.now() - startTime < timeout) {
            attemptCount++;
            try {
                // 捕获整个游戏区域
                const gameCaptureRegion = captureGameRegion({
                    X: 0,
                    Y: 0,
                    Width: genshin.width,
                    Height: genshin.height
                });

                // 裁剪出识别区域
                const croppedRegion = gameCaptureRegion.deriveCrop(
                    RecognitionArea.X, 
                    RecognitionArea.Y, 
                    RecognitionArea.Width, 
                    RecognitionArea.Height
                );
                
                let results = croppedRegion.findMulti(RecognitionObject.ocrThis);
                
                // 释放资源
                gameCaptureRegion.dispose();
                croppedRegion.dispose();

                if (results && results.count > 0) {
                    let text = "";
                    for (let i = 0; i < results.count; i++) {
                        if (results[i].text && results[i].text.trim()) {
                            text += results[i].text + " ";
                        }
                    }

                    if (text.trim()) {
                        log.info(`第${attemptCount}次尝试，识别结果: ${text.trim()}`);
                        return text.trim();
                    } else {
                        log.info(`第${attemptCount}次尝试，识别到区域但无文本`);
                    }
                } else {
                    if (attemptCount % 10 === 0) {
                        log.info(`第${attemptCount}次尝试，未识别到内容`);
                    }
                }

            } catch (error) {
                if (attemptCount % 10 === 0) {
                    log.warn(`识别过程中发生错误: ${error.message}`);
                }
            }
            await sleep(100);
        }
        log.error(`经过${attemptCount}次尝试，仍未识别到对象`);
        return null;
    }

    async function Main() {
        log.info("开始OCR识别...")

        // 获取设置
        const inputValue = settings.inputValue || "";

        if (!inputValue) {
            log.error("未填写自定义js配置的文件名");
            return;
        }

        const filePath = `test/${inputValue}.txt`;

        // 返回主界面
        await genshin.returnMainUi();
        await sleep(1000);

        // 按J键打开任务面板
        log.info("按J键打开任务面板")
        keyPress("J");
        await sleep(2000); // 等待界面刷新
        
        // 显示识别区域
        log.info("正在显示识别区域...");
        const areaInfo = await showRecognitionArea();
        if (areaInfo) {
            log.info(`区域坐标：
            左上角: (${areaInfo.x}, ${areaInfo.y})
            右下角: (${areaInfo.x + areaInfo.width}, ${areaInfo.y + areaInfo.height}`);
        }

        // 等待用户确认
        await sleep(1000);
        log.info("继续执行OCR识别...");

        // OCR识别
        const text = await recognizeImage(5000); // 5秒超时

        if (text) {
            log.info(`识别到的文本: ${text}`);

            // 保存结果
            const result = await fileReadWrite(filePath, `\n${text}`, inputValue);
            if (result) {
                log.info("任务完成，结果已保存");
            } else {
                log.error("文件保存失败");
            }
        } else {
            log.error("未能识别到文本");
        }
        // 返回主界面
        await genshin.returnMainUi();
    }
    await Main();
})();