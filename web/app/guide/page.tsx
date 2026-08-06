import Link from "next/link";

export default function GuidePage() {
  return (
    <main className="guide-page">
      <nav className="nav shell" aria-label="主导航">
        <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true">狗</span><span>狗头军师</span></Link>
        <div className="nav-links"><Link href="/">返回体验</Link><a href="https://github.com/powerycy/goutoujunshi" target="_blank" rel="noreferrer">开源仓库</a></div>
      </nav>
      <header className="guide-hero shell">
        <span className="eyebrow"><span className="live-dot" /> 公开使用手册 · 评委可直接体验</span>
        <h1>三分钟看懂<br />狗头军师怎么用</h1>
        <p>这个版本不要求登录、不需要测试账号。选匿名案例即可看到完整分析，也可以输入已经去敏的文字。核心流程约 60 秒。</p>
      </header>
      <div className="guide-content shell">
        <aside className="guide-aside" aria-label="手册目录">
          <b>目录</b>
          <a href="#quick">01 快速体验</a>
          <a href="#read">02 如何读结果</a>
          <a href="#privacy">03 隐私与清除</a>
          <a href="#safety">04 安全边界</a>
          <a href="#limits">05 产品限制</a>
        </aside>
        <article className="guide-article">
          <section id="quick"><h2>01 / 快速体验</h2><ol><li>回到首页，点击“直接体验”。</li><li>选择“暧昧降温”“投入失衡”或“边界预警”任一匿名案例。</li><li>点击“开始拆解”，依次查看情绪承接、证据分层、互惠雷达、风险检查和下一步。</li><li>点击“复制文字”，得到一条可直接发送、同时允许对方拒绝的话。</li></ol><p className="guide-callout">推荐评委先体验“边界预警”：它会从普通关系建议切换到安全与隐私处置，展示系统不是一条固定话术链。</p></section>
          <section id="read"><h2>02 / 如何读结果</h2><p><b>事实</b>只来自你提供的可观察内容；<b>合理推测</b>会明确保留不确定；<b>关键未知</b>提示哪些信息真的会改变建议。互惠雷达比较的是主动、兑现、边界和修复行为，不给任何人做“人格总分”。</p><p>明确建议永远带一个观察窗口和停止条件。目标不是让某个人必须答应，而是让用户保留自尊、安全和未来选择权。</p></section>
          <section id="privacy"><h2>03 / 隐私与清除</h2><p>评委版不设账户，不调用摄像头、通讯录或定位，不写入数据库，也不使用 <code>localStorage</code> 保存输入。文字只存在于当前页面内存；点击“清除全部”、刷新或关闭页面即可清空。</p><p>输入真实情境前，请去掉姓名、手机号、住址、公司、学校、账号、精确行程和私密影像信息。匿名示例均为产品演示文本，不是真实聊天。</p></section>
          <section id="safety"><h2>04 / 安全边界</h2><ul><li>不提供贬低、服从测试、虚假时间限制、嫉妒操控、煤气灯、孤立、跟踪或性施压方案。</li><li>明确拒绝、僵住、躲避或撤回时，建议立即停止推进。</li><li>识别到威胁、跟踪、强迫、隐私曝光等词时，优先给安全处置和支持网络建议。</li><li>即时人身危险应联系当地紧急服务；本产品不替代心理、医疗或法律专业服务。</li></ul></section>
          <section id="limits"><h2>05 / 产品限制</h2><p>评委版是可解释的浏览器端决策原型，使用仓库知识体系沉淀出的规则与场景路由，不会声称能读心或诊断心理疾病。它不能确认未提供的线下行为、语气和动机；短文本也不能代表完整关系。</p><p>公开仓库保留完整 Skill 与知识文件，Web 版是比赛要求下新增的直接体验层，不改变原有 Skill 的使用方式。</p></section>
        </article>
      </div>
    </main>
  );
}
