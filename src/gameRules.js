/* eslint guard-for-in: 0 */

function transformGameRules(rules) {
  const newRules = {}
  for (const ruleName in rules) {
    const rule = rules[ruleName]
    newRules[ruleName.toLowerCase()] = {
      ...rule,
      ruleName,
      defaultEnabled: rule.enabled,
      defaultValue: rule.value
    }
  }

  return newRules
}

const gamerules = transformGameRules({
  randomLeaders: {
    type: Boolean,
    helpText: 'Picks random team leaders upon intializing a new game session (during setup)',
    enabled: true
  },
  forceVoice: {
    type: Boolean,
    helpText: 'Forces everybody to move to their respective team channel, regardless of which voice channel they\'re currently in',
    enabled: false
  },
  ow_mysteryHeroes: {
    type: Boolean,
    helpText: 'Selects random heroes upon starting the game',
    enabled: false
  },
  /*
  ow_mysteryComps: {
    type: Boolean,
    helpText: 'Selects random (standard) team compositions upon starting the game'
  },
  */
  ow_noLimits: {
    type: Boolean,
    helpText: 'Controls whether multiple of the same heroes can be picked',
    enabled: false
  }
})

export default gamerules
