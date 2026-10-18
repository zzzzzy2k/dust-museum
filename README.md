# 吃灰台账 · dust-museum

本地优先的电子产品闲置记录工作台。记录每件设备的最后使用时间，自动计算吃灰天数、闲置价值与处置优先级。

- 线上站点：<https://zzzzzy2k.github.io/dust-museum/>
- GitHub 仓库：<https://github.com/zzzzzy2k/dust-museum>

## 功能

- 设备新增、编辑、删除，记录类别、购买日期、价格、最后使用日、上市日期、上市价格和备注
- “今天用了”一键更新最后使用日，吃灰天数按本地日期实时计算
- 全部 / 活跃 / 吃灰 / 待处置筛选，按吃灰天数、价值、上市日期或类别排序
- 设备总数、吃灰设备数、吃灰总天数、闲置总价值、最久吃灰榜与类别分布
- 类别与阈值设置、浅色 / 深色主题、JSON / CSV 导入导出
- 数据保存在浏览器 `localStorage`，无需登录，不依赖服务端

## 数据与备份

- **JSON**：包含设备、类别和阈值的完整备份；导入会覆盖当前全部数据与设置
- **CSV**：UTF-8 编码的设备表格，可用 Excel 打开和编辑；导入会覆盖设备列表，保留当前类别与阈值，并自动补建表格中出现的新类别。日期支持 `YYYY-MM-DD`、`YYYY/MM/DD` 和 `YYYY.MM.DD`（月、日可不补零）
- 导入前会显示覆盖警告和备份按钮，需确认风险后才能执行；应用内不提供撤销，建议先导出 JSON 备份

## 开发

需要 Node 22.12+（22.x 系列）。

```sh
npm ci
npm run dev
```

生产构建与本地预览：

```sh
npm run build
npm run preview
```

## 目录

```text
src/                应用源码（页面、组件、hooks、台账数据逻辑、样式）
.github/workflows/  GitHub Pages 自动部署
scripts/            构建与 Node 版本检查
vendor/             随项目内置的样式文件及许可证
```

## 部署

推送到 `main` 后，GitHub Actions 会执行 `npm ci` 和 `npm run build`，并将 `dist/` 发布到 GitHub Pages。站点使用相对资源路径，可直接部署在仓库子路径下。

## 来源

项目基于 Qoder Sites React starter 与 Shadcn 样式资源构建，来源许可见 [PROVENANCE.md](PROVENANCE.md) 和 `vendor/`。
