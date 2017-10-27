const defaultRuleSet = {
  randomLeaders: {
    type: Boolean,
    helpText: 'Picks random team leaders upon intializing a new game session (during setup)',
    enabled: true
  },
  forceVoice: {
    type: Boolean,
    helpText: 'Forces everybody to move to their respective team channel, regardless of which voice channel they\'re currently in',
    enabled: false
  }
}

export default defaultRuleSet
