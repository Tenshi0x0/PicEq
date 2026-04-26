# PicEq

PicEq 是一个本地运行的 LaTeX 公式编辑器，可以把公式渲染为 SVG，并把可继续编辑的公式项目保存为 JSON。界面参考了 Thomas Lochmatter 的 LaTeX to SVG 工具：输入 LaTeX、预览 SVG、设置颜色和缩放，然后导出。

## 功能

- LaTeX 输入和 MathJax SVG 预览。
- 导出当前公式为 `.svg`。
- 支持 Display mode 和 Inline mode。
- 支持 MathJax 默认颜色、黑色、自定义 CSS 颜色。
- 支持默认缩放、手动设置 `1ex = Npx`、按指定字体和字号匹配 `ex`。
- 支持把公式、颜色、缩放、display mode 等编辑状态保存为 JSON。
- 支持从本地指定目录读取、保存和列出 JSON 项目，也支持浏览器文件选择导入 JSON。

## 运行

需要 Node.js 18 或更新版本。

```powershell
npm start
```

启动后打开：

```text
http://localhost:3000
```

如果需要换端口：

```powershell
$env:PORT=5173; npm start
```

如果看到 `Port 3000 is already in use.`，说明已有服务占用了 3000。可以直接打开已有服务，或者换端口启动：

```powershell
$env:PORT=5173; npm start
```

## 导出 SVG

1. 在 `LaTeX` 输入框中输入公式。
2. 调整颜色、缩放和渲染方式。
3. 查看 `SVG 预览` 和 `SVG 源码`。
4. 点击 `下载 SVG`，浏览器会下载 `equation.svg`。

SVG 的宽高会按当前缩放设置写成 `px`，同时在根节点保留 `data-piceq-scale`，例如 `1ex=8px`。

## 复制 SVG 到剪贴板

点击 `复制 SVG` 后，PicEq 会先重新渲染当前公式，然后执行两件事：

1. 在项目根目录的 `cache/` 目录下保存一份 `.svg` 文件；如果 `cache/` 不存在，服务端会自动创建。
2. 把这个 `.svg` 文件本身放入系统剪贴板，行为等同于在资源管理器里复制该 SVG 文件，方便直接粘贴到 PowerPoint。

这个复制动作由本地 Node.js 服务调用 Windows PowerShell 的 `Set-Clipboard -LiteralPath` 完成，因此需要在 Windows 上运行服务。

## 保存和导入 JSON

PicEq 的 JSON 项目用于后续继续编辑，它不是 SVG，而是保存编辑状态：

```json
{
  "version": 1,
  "latex": "x = \\sin \\left( \\frac{\\pi}{2} \\right)",
  "options": {
    "autoUpdate": true,
    "colorMode": "default",
    "customColor": "#1d4ed8",
    "scaleMode": "default",
    "manualExPx": 8,
    "fontFamily": "Arial",
    "fontSizePx": 16,
    "displayMode": true
  }
}
```

### 保存到本地指定目录

1. 在 `本地目录` 中输入运行服务这台机器上的目录，例如：

```text
D:\Works\PicEq\projects
```

2. 在 `文件名` 中输入项目文件名，例如：

```text
equation.json
```

3. 点击 `保存到目录`。

服务端会自动创建不存在的目录，并写入 `.json` 文件。为了避免误把文件名当路径使用，文件名不能包含 `\ / : * ? " < > |`。

### 从指定目录导入

如果已经知道目录和文件名，填写 `本地目录` 和 `文件名` 后点击 `按路径导入`。

也可以只填写目录，然后点击 `列出目录`，页面会列出该目录下的 `.json` 项目，再点击对应项目的 `导入`。

### 从浏览器导入

如果 JSON 文件不在服务端可访问路径中，可以使用 `从浏览器选择 JSON 导入` 直接选择文件。这个方式只读取浏览器选择的文件，不会写入服务端目录。

## 运行机制

- `server.js` 使用 Node.js 原生 HTTP 服务提供网页和 JSON 文件 API。
- `public/index.html`、`public/styles.css`、`public/app.js` 是前端界面。
- 前端通过 MathJax 4 的 TeX to SVG 输出把 LaTeX 转成 SVG。
- 点击 `复制 SVG` 时，前端调用 `/api/svg/cache` 把 SVG 写入项目根目录的 `cache/`，服务端再把该 SVG 文件路径作为文件放入系统剪贴板。
- 保存到本地目录时，浏览器把 JSON 项目发给 `/api/projects/save`，Node.js 服务在本机文件系统写入文件。
- 导入项目时，前端调用 `/api/projects/load` 或读取浏览器选择的 JSON 文件，然后恢复 LaTeX、颜色、缩放和渲染方式。

## 注意

MathJax 脚本默认从 jsDelivr CDN 加载。第一次打开页面需要网络；浏览器缓存后通常可以离线继续使用已缓存资源。
