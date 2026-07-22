Component({
  properties: {
    ticketCount: { type: Number, value: 0 }
  },
  methods: {
    submit() { this.triggerEvent('submit') },
    preview() { this.triggerEvent('preview') }
  }
})
