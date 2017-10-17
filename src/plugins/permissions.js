import { RichEmbed } from 'discord.js'

const PERM_PERMISSIONS = 'permissions'

const PERMS_PER_PAGE = 5

export default function load({registerCommand: register, permissions}) {
  permissions.registerPermission(PERM_PERMISSIONS, 'Allows managing permissions using the !perm command')

  register('perm', {
    desc: 'Manages permisions',
    extra: `Syntax: **perm** <action>
**perm list** [page]
**perm grant|revoke role|user** <permission_node>
**perm clear role|user**
`
  }, (bot, message, args) => {
    permissions.checkPermission(message, PERM_PERMISSIONS)
      .then((granted) => {
        if (granted) {
          const action = args[0]

          permissions.getPermissions().then((permNodes) => {
            if (permNodes.length === 0) {
              console.log('No permissions registered?')
              return
            }

            if (action === 'list') {

              const embed = new RichEmbed()
                .setTitle('6v6 - Permissions')
                .setColor(0xA94AE8)
                .setTimestamp()

              const maxPage = Math.ceil(Math.max(permNodes.length / PERMS_PER_PAGE, 1))
              const page = Math.max(Math.min(Number(args[1]) || 1, maxPage), 1)

              embed.setFooter('page ' + page + ' of ' + maxPage, 'https://cdn.discordapp.com/embed/avatars/0.png')

              const lastPermNode = Math.min(page * PERMS_PER_PAGE, permNodes.length)
              for (let i = (page - 1) * PERMS_PER_PAGE; i < lastPermNode; i++) {
                const permNode = permNodes[i]
                embed.addField('`' + permNode.node + '`' , permNode.helpText, false)
              }

              message.channel.send({embed})

            } else if (action === 'grant') {
            } else if (action === 'revoke') {
            } else if (action === 'clear') {
            } else {
              message.channel.send('Invalid action name, check !help perm for the usage information')
            }
          })
        } else {
          message.channel.send('You don\'t have permission to manage permissions')
        }
      })
  })
}
