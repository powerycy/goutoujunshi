import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'

const ROUTES = [
  { match: /回复|怎么回|开场|邀约|话术|表达/, files: ['references/practical/实战话术编排器：从一句回复到后续分支.md'] },
  { match: /截图|聊天|网聊|记录|身份|发送者/, files: ['references/knowledge/09-在线约会与数字关系.md', 'references/practical/ChatLab聊天记录分析适配.md'] },
  { match: /记忆|档案|多年|撤销|删除|压缩/, files: ['references/practical/长期记忆与关系档案.md'] },
  { match: /投入|冷淡|失衡|退出/, files: ['references/practical/关系投入失衡：互惠判断、降级投入与退出决策.md'] },
  { match: /冲突|吵架|修复|道歉/, files: ['references/knowledge/07-沟通冲突与修复.md'] },
  { match: /依恋|焦虑|情绪/, files: ['references/knowledge/03-依恋理论与情绪调节.md'] },
  { match: /同意|边界|亲密|身体/, files: ['references/knowledge/08-同意边界性与亲密.md'] },
  { match: /安全|家暴|跟踪|威胁|法律|自伤/, files: ['references/knowledge/17-中国法律安全与危机转介.md'] },
  { match: /证据|来源|可信|预测|趋势|K线/, files: ['references/knowledge/01-证据分级与内容边界.md', 'references/practical/ChatLab聊天记录分析适配.md'] },
]

export function selectReferences(question, limit = 3) {
  const selected = []
  for (const route of ROUTES) {
    if (!route.match.test(question)) continue
    for (const file of route.files) if (!selected.includes(file)) selected.push(file)
    if (selected.length >= limit) break
  }
  if (!selected.length) selected.push('references/practical/00-导读与使用分级.md')
  return selected.slice(0, Math.max(1, Math.min(3, limit)))
}

export async function loadSelectedReferences(skillRoot, question, limit = 3) {
  const files = selectReferences(question, limit)
  const root = resolve(skillRoot)
  const loaded = []
  for (const relativePath of files) {
    const absolutePath = resolve(root, relativePath)
    if (!absolutePath.startsWith(`${root}${sep}`)) throw new Error('参考文件路径越界')
    const text = await readFile(absolutePath, 'utf8')
    loaded.push({ path: relativePath, excerpt: text.slice(0, 7000) })
  }
  return loaded
}
