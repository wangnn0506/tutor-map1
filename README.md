# 杭州家教地图

移动端优先的家教岗位浏览原型。React、TypeScript 和 Vite。四个样例来自用户提供的群公告，发布数据只包含简化的岗位信息和演示用公共地标坐标。

## 运行

```sh
npm ci
npm run dev
npm run build
```

生产构建输出到 `dist/`。

## 配置高德

未配置时显示可以缩放、平移和点选岗位的杭州示意图。可以在「地图设置」中临时配置当前浏览器标签页，也可在构建时复制 `.env.example` 为 `.env.local` 并填入以下值。

- `VITE_AMAP_KEY` 为高德开放平台 Web 端（JS API）Key。启用域名白名单时，加入实际访问域名。
- `VITE_AMAP_SERVICE_HOST` 为 HTTPS 安全代理地址，结尾为 `/_AMapService`。跨域代理需要允许站点源访问。
- 高德的 `securityJsCode` 由代理服务器保存。按[高德安全密钥文档](https://lbs.amap.com/api/javascript-api-v2/guide/abc/jscode)配置代理。

内置岗位可在 `src/jobs.ts` 更新。价格筛选以时薪区间下限为准。「优先女老师」会显示在卡片上，参与性别匹配时仍按不限处理。岗位示例坐标须经人工核对后才能用于实际发布。

当前版本以模拟岗位验证地图和浏览流程。微信登录、证件审核、数据库和运营录入后台属于后续范围。
