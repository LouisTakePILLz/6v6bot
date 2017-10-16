const PERM_SETCHANNEL = 'setChannel'
const PERM_SETLOBBY = 'setLobby'

const commands = (api) => ({
  setChannel(bot, message, args) {
    const { author } = message

    api.permissions.hasPermission(message, PERM_SETCHANNEL).or('admin').or('channels')
      .then((granted) => {
        if (granted) {
          const query = { serverId: message.server.id, setting: 'commandChannel' }

          api.db.collection('servers').update(query, { value: message.channel.id, ...query }, { upsert: true }, (err, numAffected) => {
            if (err) {
              console.log('setChannel DB ERROR', err)

              bot.sendMessage(message, 'An error occured while trying to set the command channel')

              return
            }

            bot.sendMessage(message, 'Command channel successfully set', undefined, (err, confirmationMsg) => {
              if (err) {
                console.log('setChannel FAILED TO SEND SUCCESS MESSAGE')
                return
              }
            })
          })
        } else {
          bot.reply(message, 'You don\'t have permission to set the command channel')
        }
      })
  },
  setLobby(bot, message, args) {
    const { author } = message
    api.permissions.hasPermission(message, PERM_SETLOBBY).or('admin').or('channels')
      .then((granted) => {
        if (granted) {
          bot.reply(message, 'WUT')
        } else {
          bot.reply(message, 'You don\'t have permission to set the lobby channel')
        }
      })
  }
})

export default function load(api) {
  const { registerCommand: register, permissions } = api
  const cmds = commands(api)

  permissions.registerPermission(PERM_SETCHANNEL, 'Allows using the !setchannel command')
  permissions.registerPermission(PERM_SETLOBBY, 'Allows using the !setlobby command')

  register('setchannel', 'Sets the channel to use to administrate 6v6 lobbies', cmds.setChannel)
  register('setlobby', 'Sets the current voice channel as the lobby for regrouping players before and after games', cmds.setLobby)
  register('debug', 'debug', (bot, message, args) => {
    api.permissions.grantPermission(message, 'channels')
  })
}
