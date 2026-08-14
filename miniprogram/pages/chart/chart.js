// 温度曲线页：使用原生 Canvas 2D 自绘折线图，无需任何第三方图表库，
// 支持点击查看数值、导出图片（保存到相册 / 系统分享）。
const db = require('../../utils/db')

const COLORS = {
  line: '#ff6b6b',
  point: '#ff6b6b',
  hover: '#e53935',
  grid: '#ececec',
  text: '#999999'
}

Page({
  data: {
    loading: true,
    empty: false,
    count: 0,
    exporting: false
  },

  onReady() {
    this.load()
  },

  async load() {
    this.setData({ loading: true })
    try {
      const list = await db.getAllRecords() // 按日期倒序
      const records = list.reverse()        // 转为升序，便于画曲线
      this.records = records
      this.setData({ count: records.length, empty: records.length === 0, loading: false })
      if (records.length) this.draw(-1)
    } catch (e) {
      console.error(e)
      this.setData({ loading: false })
      const info = db.friendlyError(e)
      wx.showModal({ title: '云环境异常', content: info.hint + '\n\n原始错误：' + info.raw, showCancel: false })
    }
  },

  // 绘制曲线，hoverIndex 为要高亮的点下标（-1 表示不高亮）
  draw(hoverIndex) {
    const that = this
    wx.createSelectorQuery()
      .in(this)
      .select('#chart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res || !res[0] || !res[0].node) return
        const canvas = res[0].node
        const width = res[0].width
        const height = res[0].height
        const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
        const dpr = info.pixelRatio || 2
        canvas.width = width * dpr
        canvas.height = height * dpr
        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)
        that.canvas = canvas // 供导出使用

        const records = that.records
        const padL = 44, padR = 20, padT = 24, padB = 40
        const plotW = width - padL - padR
        const plotH = height - padT - padB

        // Y 轴范围：数据上下各留 0.5℃ 余量，且不小于 1℃
        let min = Infinity, max = -Infinity
        records.forEach(r => {
          if (r.temp < min) min = r.temp
          if (r.temp > max) max = r.temp
        })
        min = Math.floor((min - 0.5) * 10) / 10
        max = Math.ceil((max + 0.5) * 10) / 10
        if (max - min < 1) max = min + 1

        ctx.clearRect(0, 0, width, height)
        // 填充白色背景，避免导出图片背景透明
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)

        // 网格 + Y 轴刻度
        ctx.font = '11px sans-serif'
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        const yTicks = 5
        for (let i = 0; i <= yTicks; i++) {
          const v = min + (max - min) * i / yTicks
          const y = padT + plotH - (v - min) / (max - min) * plotH
          ctx.strokeStyle = COLORS.grid
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(padL, y)
          ctx.lineTo(width - padR, y)
          ctx.stroke()
          ctx.fillStyle = COLORS.text
          ctx.fillText(v.toFixed(1), padL - 8, y)
        }

        const n = records.length
        const xStep = n > 1 ? plotW / (n - 1) : 0
        const xAt = (i) => padL + xStep * i
        const yAt = (t) => padT + plotH - (t - min) / (max - min) * plotH

        // 折线
        ctx.strokeStyle = COLORS.line
        ctx.lineWidth = 2
        ctx.lineJoin = 'round'
        ctx.beginPath()
        records.forEach((r, i) => {
          const x = xAt(i)
          const y = yAt(r.temp)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()

        // X 轴日期刻度（最多 6 个，显示 MM-DD）
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const labelEvery = Math.max(1, Math.ceil(n / 6))
        records.forEach((r, i) => {
          if (i % labelEvery === 0 || i === n - 1) {
            ctx.fillStyle = COLORS.text
            ctx.fillText(r.date.slice(5), xAt(i), height - padB + 12)
          }
        })

        // 数据点 + 高亮
        records.forEach((r, i) => {
          const x = xAt(i)
          const y = yAt(r.temp)
          ctx.beginPath()
          ctx.arc(x, y, i === hoverIndex ? 6 : 3, 0, Math.PI * 2)
          ctx.fillStyle = i === hoverIndex ? COLORS.hover : COLORS.point
          ctx.fill()
          if (i === hoverIndex) {
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 2
            ctx.stroke()
          }
        })

        // 悬浮提示气泡
        if (hoverIndex >= 0) {
          const r = records[hoverIndex]
          const text = r.date + '  ' + r.temp + '℃'
          ctx.font = '12px sans-serif'
          const tw = ctx.measureText(text).width
          const rw = tw + 16, rh = 26
          let tx = xAt(hoverIndex) - rw / 2
          tx = Math.max(padL, Math.min(width - padR - rw, tx))
          const ty = Math.max(4, yAt(r.temp) - 34)
          ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
          ctx.beginPath()
          ctx.moveTo(tx + 6, ty)
          ctx.arcTo(tx + rw, ty, tx + rw, ty + rh, 6)
          ctx.arcTo(tx + rw, ty + rh, tx, ty + rh, 6)
          ctx.arcTo(tx, ty + rh, tx, ty, 6)
          ctx.arcTo(tx, ty, tx + rw, ty, 6)
          ctx.closePath()
          ctx.fill()
          ctx.fillStyle = '#ffffff'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(text, tx + rw / 2, ty + rh / 2 + 1)
        }
      })
  },

  // 点击曲线查看对应日期与体温
  onTouchStart(e) {
    if (!this.records || this.records.length < 2) return
    const that = this
    wx.createSelectorQuery()
      .in(this)
      .select('#chart')
      .boundingClientRect((rect) => {
        if (!rect) return
        const x = e.touches[0].x - rect.left
        const n = that.records.length
        const padL = 44, padR = 20
        const plotW = rect.width - padL - padR
        const xStep = plotW / (n - 1)
        let idx = Math.round((x - padL) / xStep)
        idx = Math.max(0, Math.min(n - 1, idx))
        that.draw(idx)
      })
      .exec()
  },

  // 导出曲线图片：优先弹系统分享菜单（可保存到相册/转发），低版本回退直接存相册
  async onExport() {
    if (!this.canvas || this.data.exporting || this.data.empty) return
    this.setData({ exporting: true })
    wx.showLoading({ title: '生成图片中', mask: true })
    try {
      const res = await new Promise((resolve, reject) => {
        wx.canvasToTempFilePath({ canvas: this.canvas, success: resolve, fail: reject }, this)
      })
      wx.hideLoading()
      if (wx.showShareImageMenu) {
        wx.showShareImageMenu({ path: res.tempFilePath })
      } else {
        this.saveToAlbum(res.tempFilePath)
      }
    } catch (e) {
      wx.hideLoading()
      console.error(e)
      wx.showToast({ title: '生成图片失败', icon: 'none' })
    } finally {
      this.setData({ exporting: false })
    }
  },

  saveToAlbum(filePath) {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: () => wx.showToast({ title: '已保存到相册', icon: 'success' }),
      fail: (err) => {
        const msg = err && err.errMsg ? err.errMsg : ''
        if (msg.indexOf('auth') > -1 || msg.indexOf('deny') > -1) {
          wx.showModal({
            title: '需要相册权限',
            content: '请在设置中允许「保存到相册」后重试',
            confirmText: '去设置',
            success: (r) => {
              if (r.confirm) wx.openSetting()
            }
          })
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' })
        }
      }
    })
  }
})
