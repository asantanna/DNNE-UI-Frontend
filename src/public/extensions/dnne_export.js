// DNNE Queue Export Extension
// Save this as: DNNE-UI-Frontend/src/public/extensions/dnne_export.js

(function() {
    // Wait for the app to be ready
    function waitForApp() {
        if (typeof app === 'undefined') {
            setTimeout(waitForApp, 100);
            return;
        }
        
        // Register the extension
        app.registerExtension({
            name: "DNNE.QueueExport",
            async setup() {
                // Wait for UI to be ready
                const checkInterval = setInterval(() => {
                    const menu = document.querySelector(".comfy-menu");
                    if (!menu) return;
                    
                    // Check if button already exists
                    if (document.getElementById("dnne-export-btn")) {
                        clearInterval(checkInterval);
                        return;
                    }
                    
                    // Create export button
                    const exportButton = document.createElement("button");
                    exportButton.id = "dnne-export-btn";
                    exportButton.textContent = "Export DNNE Queue";
                    exportButton.style.marginLeft = "10px";
                    exportButton.className = "comfy-menu-btns";
                    exportButton.title = "Export workflow as queue-based Python script";
                    
                    exportButton.onclick = async () => {
                        try {
                            exportButton.disabled = true;
                            exportButton.textContent = "Exporting...";
                            
                            // Get the current workflow
                            const workflow = app.graph.serialize();
                            
                            // Get the prompt (node configurations)
                            const prompt = await app.graphToPrompt();
                            
                            // Send to server
                            const response = await fetch('/dnne/export', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({
                                    prompt: prompt.output,
                                    workflow: workflow,
                                    name: workflow.title || "DNNE Export"
                                })
                            });
                            
                            const result = await response.json();
                            
                            if (result.success) {
                                // Download file
                                const blob = new Blob([result.script], {type: 'text/plain'});
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = result.filename;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                                
                                // Show success notification
                                if (app.ui && app.ui.dialog) {
                                    app.ui.dialog.show(`
                                        <h3 style="margin-top: 0">Export Successful!</h3>
                                        <p>Workflow exported as: <code>${result.filename}</code></p>
                                        <p>The queue-based Python script has been downloaded to your default downloads folder.</p>
                                        <br>
                                        <p><small>You can run it with: <code>python ${result.filename}</code></small></p>
                                    `);
                                } else {
                                    alert('Export successful! File downloaded: ' + result.filename);
                                }
                            } else {
                                throw new Error(result.error || 'Export failed');
                            }
                        } catch (error) {
                            console.error('DNNE Export error:', error);
                            
                            // Show error dialog
                            if (app.ui && app.ui.dialog) {
                                app.ui.dialog.show(`
                                    <h3 style="margin-top: 0; color: #ff4444">Export Failed</h3>
                                    <p style="color: #ff6666">${error.message}</p>
                                    <br>
                                    <details>
                                        <summary>Details</summary>
                                        <pre style="font-size: 0.9em; overflow: auto">${error.stack || error}</pre>
                                    </details>
                                `);
                            } else {
                                alert('Export failed: ' + error.message);
                            }
                        } finally {
                            exportButton.disabled = false;
                            exportButton.textContent = "Export DNNE Queue";
                        }
                    };
                    
                    // Find a good place to insert the button
                    // Try to insert it before the Queue button for logical grouping
                    const queueButton = menu.querySelector("button[id='queue-button']");
                    if (queueButton) {
                        menu.insertBefore(exportButton, queueButton);
                    } else {
                        // Otherwise just append to the end
                        menu.appendChild(exportButton);
                    }
                    
                    clearInterval(checkInterval);
                    
                    console.log("DNNE Queue Export button added to menu");
                }, 100);
            }
        });
    }
    
    // Start the process
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', waitForApp);
    } else {
        waitForApp();
    }
})();
