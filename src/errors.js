export class GenericError extends Error {
  constructor(msg, ...params) {
    super(...params)

    this.errMsg = msg
  }
}

export class InvalidGameRuleValue extends Error {
  constructor(value, ...params) {
    super(...params)

    this.gameRuleValue = value
  }
}

// Used for reporting missing channels...
export class ChannelConfigurationError extends GenericError {}

export class CommandChannelNotRegisteredError extends Error {}

export class InvalidTeamNameError extends Error {
  constructor(teamName, ...params) {
    super(...params)

    this.teamName = teamName
  }
}

export class DuplicatePlayerError extends GenericError {}

export class NotEnoughPlayersError extends GenericError {}

export class DbError extends Error {}
