export const TEAM_NAMES = {
  team1: 'Team 1',
  team2: 'Team 2'
}

export const PERM_ADMIN = 'administrate_lobby'
export const PERM_SETUP = 'setup'
export const PERM_GAMERULE = 'gamerules'
export const PERM_CHANNELS = 'channels'
export const PERM_PERMISSIONS = 'permissions'
export const PERM_LISTING = 'listing'
export const PERM_SETLEADER = 'setLeader'

const TEAM_NAMES_LIST = Object.keys(TEAM_NAMES).map(x => '`' + x + '`').join(', ')
export const MSG_INVALID_TEAM_NAME = `The specified team name is invalid. Possible values: ${TEAM_NAMES_LIST}`
export const MSG_CMD_CHANNEL_NOT_REGISTERED = 'This text channel is not a registered command channel'
export const MSG_ERR_LOOKUP_CMDCHANNEL = 'An error occured while trying to look up the command channel'
export const MESSAGE_INVALID_TARGET_MEMBER = 'Invalid target; the target user couldn\'t be resolved'
