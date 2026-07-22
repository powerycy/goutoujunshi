const Analysis = require('../../services/analysis-api')

const STATUS = { queued:'排队中',running:'分析中',delivered:'已交付',blocked:'安全流程',failed:'未交付' }
Page({
  data: { items: [], loading: true, error: '' },
  onShow() { this.load() },
  async load() {
    try {
      await getApp().ready(); const response=await Analysis.list()
      const items=response.items.map((item,index)=>Object.assign({},item,{indexLabel:String(index+1).padStart(2,'0'),statusLabel:STATUS[item.status]||item.status,dateLabel:(item.createdAt||'').replace('T',' ').slice(0,16)}))
      this.setData({items,loading:false,error:''})
    } catch(error){this.setData({loading:false,error:error.message})}
  },
  open(event){const item=this.data.items.find((row)=>row.id===event.currentTarget.dataset.id);if(!item)return;if(item.status==='queued'||item.status==='running')wx.navigateTo({url:`/pages/analysis-loading/index?id=${item.id}`});else wx.navigateTo({url:`/pages/analysis-result/index?id=${item.id}`})},
  remove(event){const id=event.currentTarget.dataset.id;wx.showModal({title:'删除这条判断？',content:'问题正文和分析结果将不可恢复。',confirmColor:'#18c463',success:async(result)=>{if(!result.confirm)return;try{await Analysis.remove(id);this.load()}catch(error){wx.showToast({title:error.message,icon:'none'})}}})},
  goHome(){wx.reLaunch({url:'/pages/home/index'})}
})
