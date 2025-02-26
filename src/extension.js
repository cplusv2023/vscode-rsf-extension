// extension.js
const vscode = require('vscode');
const { exec } = require('child_process');
const fs = require('fs');

function activate(context) {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'rsfViewer.rsf',
      new RsfCustomEditor(),
      {
        webviewOptions: {
          retainContextWhenHidden: true
        },
        supportsMultipleEditorsPerDocument: false
      }
    )
  );
}

class RsfCustomEditor {
  constructor() {
    // 定义允许执行的命令列表
    this.allowedCommands = ['sfdisfil', 'sfinfo', 'sfin']; // 根据需要添加更多允许的命令
  }

  resolveCustomTextEditor(document, webviewPanel, _token) {
    this.filePath = document.uri.fsPath;
    const filePath = document.uri.fsPath;

    // 设置初始的自定义命令
    let customCommand = `sfdisfil < "${filePath}" col=5 number=y`;

    // 执行 sfin < file.rsf
    exec(`sfin < "${filePath}"`, (error1, stdout1, stderr1) => {
      let sfinOutput = stdout1;
      if (error1) {
        sfinOutput = `Error when running \"sfin < ${filePath} \": ${stderr1}`;
      }
      exec(`sfattr < "${filePath}"`, (error11, stdout11, stderr11) => {
        let sfattrOutput = stdout11;
        if (error11) {
              sfattrOutput = `Error when running \"sfattr < ${filePath} \": ${stderr11}`;
            }
            exec(`sfget all=y < "${filePath}"`, (error111, stdout111, stderr111) => {
              let sfgetOutput = stdout111;
              if (error111) {
                    sfgetOutput = `Error when running \"sfget < ${filePath} \": ${stderr111}`;
                  }
             sfattrOutput = sfattrOutput +  "Headers:\n" + sfgetOutput;

      // 执行初始的自定义命令
      this.runCustomCommand(customCommand, (sfdisfilOutput) => {
        // 读取文件的文本内容，直到遇到 \x0c\x0c\x04
        fs.readFile(filePath, (err, data) => {
          let textContent = '';
          if (err) {
            textContent = `Error reading file: ${err.message}`;
          } else {
            const sequence = Buffer.from([12, 12, 4]); // \x0c\x0c\x04
            const index = data.indexOf(sequence);
            if (index !== -1) {
              // 找到序列，截取之前的内容
              textContent = data.slice(0, index).toString('utf8');
            } else {
              // 未找到序列，读取整个文件
              textContent = data.toString('utf8');
            }
          }

          // 设置 Webview 内容
          webviewPanel.webview.html = this.getHtmlContent(
            sfinOutput,sfattrOutput,
            sfdisfilOutput,
            textContent,
            customCommand
          );

          // 监听来自 Webview 的消息
          webviewPanel.webview.onDidReceiveMessage((message) => {
            if (message.command === 'runCustomCommand') {
              customCommand = message.text;
              this.runCustomCommand(customCommand, (newOutput) => {
                // 发送新的输出回 Webview
                webviewPanel.webview.postMessage({
                  command: 'updateOutput',
                  output: newOutput
                });
              });
            }
          });
        });
      });
    });
    });
    });

    // 允许 Webview 使用 VSCode API
    webviewPanel.webview.options = {
      enableScripts: true
    };
  }

  runCustomCommand(command, callback) {
    const trimmedCommand = command.trim();
    const firstWord = trimmedCommand.split(' ')[0];
    if (this.allowedCommands.includes(firstWord)) {
      exec(command, (error, stdout, stderr) => {
        let output = stdout;
        // if (error) {
        //   output = `Error: ${stderr}`;
        // }
        callback(output);
      });
    } else {
      callback(`Error: Command not allowed.`);
    }
  }

  getHtmlContent(sfinOutput, sfattrOutput, sfdisfilOutput, textContent, customCommand) {
    return `
      <!DOCTYPE html>
      <html lang="zh-CN">
      <head>
        <meta charset="UTF-8">
        <title>RSF Viewer</title>
        <style>
          body {
            font-family: var(--vscode-editor-font-family, sans-serif);
            font-size: var(--vscode-editor-font-size, 14px);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 0;
          }
          .container {
            display: flex;
            height: 100vh;
            overflow: hidden;
          }
          .left, .right {
            flex: 1;
            overflow: auto;
          }
          .left {
            display: flex;
            flex-direction: column;
            border-right: 1px solid var(--vscode-editorWidget-border);
          }
          .box {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0; /* 关键：使子元素正确处理溢出 */
          }
          .box-header {
            background-color: var(--vscode-editorGroupHeader-tabsBackground);
            color: var(--vscode-editorGroupHeader-tabsForeground);
            padding: 8px 12px;
            font-weight: bold;
            border-bottom: 1px solid var(--vscode-editorWidget-border);
            cursor: pointer;
            user-select: none;
          }
          .box-header[contenteditable="true"] {
            border: 1px solid var(--vscode-editorWidget-border);
            background-color: var(--vscode-editor-background);
          }
          .box-content {
            flex: 1;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 10px;
            overflow: auto; /* 允许垂直和水平滚动 */
            font-size: var(--vscode-editor-font-size, 14px);
            line-height: 1.6;
          }
          .box-content pre {
            margin: 0;
            font-family: var(--vscode-editor-font-family, monospace);
            white-space: pre; /* 保留空格和换行，允许水平滚动 */
          }
          /* 自定义滚动条 */
          ::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          ::-webkit-scrollbar-thumb {
            background-color: var(--vscode-scrollbarSlider-background);
            border-radius: 4px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background-color: var(--vscode-scrollbarSlider-hoverBackground);
          }
          ::-webkit-scrollbar-thumb:active {
            background-color: var(--vscode-scrollbarSlider-activeBackground);
          }
          ::-webkit-scrollbar-track {
            background: var(--vscode-editor-background);
          }
          /* 响应式调整 */
          @media (max-width: 800px) {
            .container {
              flex-direction: column;
            }
            .left, .right {
              height: 50vh;
            }
            .left {
              border-right: none;
              border-bottom: 1px solid var(--vscode-editorWidget-border);
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="left">
            <div class="box">
              <div class="box-header">sfin sfattr and sfget</div>
              <div class="box-content"><pre>${this.escapeHtml(sfinOutput + sfattrOutput)}</pre></div>

            </div>
            <div class="box">
              <!-- 可编辑的标题 -->
              <div class="box-header" id="customCommand" contenteditable="false" title="双击以编辑">${this.escapeHtml(customCommand)}</div>
              <div class="box-content"><pre id="customOutput">${this.escapeHtml(sfdisfilOutput)}</pre></div>
            </div>
          </div>
          <div class="right">
            <div class="box">
              <div class="box-header">File Header</div>
              <div class="box-content"><pre>${this.escapeHtml(textContent)}</pre></div>
            </div>
          </div>
        </div>
        <script>
          const vscode = acquireVsCodeApi();
          const customCommandHeader = document.getElementById('customCommand');
          const customOutputPre = document.getElementById('customOutput');

          customCommandHeader.addEventListener('dblclick', () => {
            customCommandHeader.contentEditable = 'true';
            customCommandHeader.focus();
          });

          customCommandHeader.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              customCommandHeader.contentEditable = 'false';
              runCustomCommand(customCommandHeader.innerText);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              customCommandHeader.contentEditable = 'false';
              customCommandHeader.innerText = '${this.escapeHtml(customCommand)}';
            }
          });

          customCommandHeader.addEventListener('blur', () => {
            if (customCommandHeader.contentEditable === 'true') {
              customCommandHeader.contentEditable = 'false';
              runCommandIfChanged();
            }
          });

          function runCommandIfChanged() {
            const newCommand = customCommandHeader.innerText.trim();
            if (newCommand !== '${this.escapeHtml(customCommand)}') {
              runCustomCommand(newCommand);
            }
          }

          function runCustomCommand(command) {
            vscode.postMessage({
              command: 'runCustomCommand',
              text: command
            });
          }

          window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
              case 'updateOutput':
                customOutputPre.textContent = message.output;
                break;
            }
          });
        </script>
      </body>
      </html>
    `;
  }

  // 转义 HTML 特殊字符
  escapeHtml(text) {
    if (!text) return text;
    return text.replace(/[&<>"'`=\/]/g, function (s) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '/': '&#x2F;',
        '=': '&#x3D;',
        '`': '&#x60;'
      }[s];
    });
  }
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
