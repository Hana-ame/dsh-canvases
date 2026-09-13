# 转发给「创造模式」会话（preset cordis）的 prompt

> 直接复制下面整段发过去即可。前置条件：那个会话必须有 cordis 工具集，且要在**网页 GUI** 里使用。

------------------------------------------------------------------------

任务：在当前 DSH 进程里新建并运行一个动态 Cordis 插件，让 Agent Canvas 画布改由源码目录 /tmp/graphc-2/ 提供。

背景（你没参与之前的会话，以下是全部所需信息）：
- 动态 Cordis 包是「进程内 + 以会话为界」的，只有挂了 cordis 工具集的会话能定义与运行它——也就是你的会话。
- 现在有一个正在运行的画布插件（pluginId 大概率是 graphc-1）。我们要另起一个新插件来取代它。
- 必须在网页 GUI 的会话里做：带浏览器半的包需要页面批准才能运行；没有页面连接时 cordis_run 会一直挂着不结算。

请严格按顺序做，不要改动任何源码文件的内容：

1. 读取这两个文件的完整内容（原样使用，不改逻辑）：
   - host 半：/tmp/graphc-2/host.js
   - client 半：/tmp/graphc-2/loader.client.js
   并确认 UI 源存在：/tmp/graphc-2/v21.client.js，应为 143027 字节、md5 = 92840f730bd5d2935deda710b74872ec。
   （UI 源码不进包参数：host 半的 canvas-source handler 会在运行时从磁盘读它。）

2. 先看清现状：调用 cordis_inspect_self；必要时再 cordis_inspect_list。找到当前正在运行的画布插件。

3. 用 cordis_stop 停掉那个旧画布插件（只 stop，不要 undefine——保留其定义以便回滚）。这样新旧两个画布不会同时挂在同一个 slot 上。如果它本来就没在跑，跳过本步。

4. 用 cordis_define 新建插件：
   - plugin.kind = "new"
   - idPrefix = "gcv2"（4–6 个字母）
   - host 半代码 = 第 1 步读到的 host.js 内容
   - client 半代码 = 第 1 步读到的 loader.client.js 内容
   只提交这两段代码，不要改动。

5. 用 cordis_run 运行它：pluginId 用上一步的插件 id，packageId 用 define 返回的 packageId，mode = "run"。
   因为这是带浏览器半的包，结果很可能先是 awaiting-approval——这不是失败，请等我（用户）在页面上点「允许」。若迟迟不结算，把当前状态如实告诉我。

6. 汇报四项：新插件的 pluginId、packageId、run id、run 的最终状态。

验收：我刷新页面后画布由新插件渲染。若页面出现「Agent Canvas 无法加载前端源码」或其它错误，请把错误原文贴出来。

------------------------------------------------------------------------
