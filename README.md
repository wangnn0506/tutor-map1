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

未配置时显示可以缩放、平移和点选岗位的杭州示意图。构建时复制 `.env.example` 为 `.env.local` 并填入以下值。

- `VITE_AMAP_KEY` 为高德开放平台 Web 端（JS API）Key。启用域名白名单时，加入实际访问域名。
- `VITE_AMAP_SERVICE_HOST` 为安全代理地址（HTTPS 页面须使用 HTTPS 代理），结尾为 `/_AMapService`。跨域代理需要允许站点源访问。
- 高德的 `securityJsCode` 由代理服务器保存。按[高德安全密钥文档](https://lbs.amap.com/api/javascript-api-v2/guide/abc/jscode)配置代理。

点击地图上的定位按钮可读取浏览器当前位置。公网部署需启用 HTTPS 才能使用浏览器定位。距离按当前位置与岗位公开地标的直线距离计算。

示例岗位在 `src/demo-jobs.ts`。岗位模型、行政区和筛选规则在 `src/jobs.ts`，筛选接收独立的岗位数据源。岗位的时薪报价与筛选区间有交集时匹配，可以只填最低价或最高价。「优先女老师」会显示在卡片上，参与性别匹配时仍按不限处理。岗位示例坐标须经人工核对后才能用于实际发布。

用户端当前开放浏览。微信登录和证件审核属于后续范围。

## 岗位 API 与运营后台

Node 24+ 运行 TypeScript 服务与内置 SQLite。应用路径为 `/demo1/`，用户端从 `/demo1/api/jobs` 读取已发布岗位，运营入口为 `/demo1/admin/`。新数据库为空，样例不会自动上线。

在项目目录创建只供服务端读取的 `.env.server`（已被 Git 忽略），将权限设为 `chmod 600 .env.server`：

```dotenv
ADMIN_PASSWORD=换成独立的高强度密码（至少12个字符）
# 可选。生产环境可指定持久化文件的绝对路径
# JOBS_DB=/home/ubuntu/tutor-map/.data/jobs.sqlite
```

- 本地开发时可运行 `ALLOW_LOCAL_ADMIN=1 npm run start:api`，另开终端运行 `npm run dev`，访问 `http://localhost:5173/demo1/admin/`。测试应使用独立数据库，可通过环境变量 `JOBS_DB` 指定路径。
- 正式部署使用 `npm run build && sudo cp -a dist/. /var/www/demo1/` 更新前端，使用 `npm run start:api` 启动服务。用 systemd 等进程管理器保持 API 运行，工作目录设为源码目录，运行账号需要拥有数据库文件的读写权限。API 只监听 `127.0.0.1:4174`，无需开放该端口。
- 在现有站点的 Nginx `server` 块中加入以下两个同级 location。已有 `/demo1/` 静态站点规则继续服务其余文件。HTTPS 终止在 Nginx，由 Nginx 覆盖传给服务端的协议头。HTTP 可读公开岗位，后台登录由 API 拒绝。

```nginx
location = /demo1/admin {
    return 302 /demo1/admin/;
}
location = /demo1/admin/ {
    root /var/www;
    try_files /demo1/index.html =404;
}
location ^~ /demo1/api/ {
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_pass http://127.0.0.1:4174;
}
```

检查并重载 Nginx。后台可整段粘贴最多 50 条带编号的公告。点击批量发布后，API 自动拆单、折算时薪、校验和去重，并返回跳过原因。批量岗位仅以城区级点位显示，原始住址和学员情况不公开，也不显示精确岗位距离。单条预览可手动修正并指定可公开的地标与高德经纬度。下架支持粘贴包含编号的原公告、用户端复制的岗位信息或纯编号。先核对匹配项，再确认下架。原公告保存在数据库中，公开接口只返回明确选择的岗位字段。服务重启后需要重新登录，已发布和已下架的岗位保留在 SQLite 中。
