import { Dialog } from "./Dialog";

export function UsageGuide({ onClose }: { onClose: () => void }) {
  return (
    <Dialog
      title="使用说明"
      subtitle="台账怎么记、状态怎么看、数据怎么备份。"
      onClose={onClose}
    >
      <div className="modal-body help-body">
        <div className="help-lead">
          <p className="eyebrow">QUICK GUIDE</p>
          <h3>记录、查看、备份</h3>
          <p>登记时填好最后使用日，之后按状态筛选、看统计，定期导出备份即可。</p>
        </div>

        <div className="help-grid">
          <section className="help-section">
            <span className="help-index num">01</span>
            <h4>记录与更新</h4>
            <p>
              每次真正使用后点“今天用了”，最后使用日会更新为今天。吃灰天数按本地日期实时计算，跨天自动刷新。
            </p>
          </section>
          <section className="help-section">
            <span className="help-index num">02</span>
            <h4>状态与筛选</h4>
            <p>
              未到吃灰阈值是“活跃”，达到为“吃灰”，达到更高的待处置阈值后标记为“待处置”。阈值和类别可在设置中调整；“吃灰”筛选包含待处置设备。
            </p>
          </section>
          <section className="help-section">
            <span className="help-index num">03</span>
            <h4>排序与统计</h4>
            <p>
              设备名录可按吃灰天数、价值、上市日期或类别排序。右侧汇总设备总数、吃灰天数、闲置价值和最久吃灰榜。
            </p>
          </section>
          <section className="help-section">
            <span className="help-index num">04</span>
            <h4>数据与备份</h4>
            <p>
              数据只保存在当前浏览器。JSON 是包含设备、类别和阈值的完整备份；CSV 是设备表格。导入会覆盖当前数据，请先导出 JSON 备份；CSV 日期支持 -、/、. 分隔。
            </p>
          </section>
        </div>

        <p className="help-note">
          无需登录，也不会上传服务器。换浏览器或清理站点数据前，请先导出备份。
        </p>
      </div>

      <footer className="modal-footer">
        <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
          知道了
        </button>
      </footer>
    </Dialog>
  );
}
