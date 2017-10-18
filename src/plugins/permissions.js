import { RichEmbed } from 'discord.js'
import * as utils from '~/utils'

const PERM_PERMISSIONS = 'permissions'

const PERMS_PER_PAGE = 5
const USERS_PER_PAGE = 9
const ROLES_PER_PAGE = 9

const MSG_INVALID_TARGET_NAME = 'Invalid target name, check `!help perm` for the usage information'
const MSG_INVALID_PERMISSION = 'Invalid permission, check `!perm list` to list the available permissions'

function showUserList(bot, message, arg) {
  message.guild.fetchMembers()

  const { members, memberCount } = message.guild

  // Not using Object.keys as 'members' is a specialized: Collection<K, V>
  const flakes = members.keyArray()

  const embed = new RichEmbed()
    .setTitle('6v6 - Users')
    .setColor(0xA94AE8)
    .setTimestamp()

  const maxPage = Math.ceil(Math.max(flakes.length / USERS_PER_PAGE, 1))
  const page = Math.max(Math.min(Number(arg) || 1, maxPage), 1)

  embed.setFooter('page ' + page + ' of ' + maxPage, 'https://cdn.discordapp.com/embed/avatars/0.png')

  const lastMember = Math.min(page * USERS_PER_PAGE, flakes.length)
  for (let i = (page - 1) * USERS_PER_PAGE; i < lastMember; i++) {
    const member = members.get(flakes[i])
    embed.addField('`' + member.id + '`', utils.sanitizeCode(member.displayName), true)
  }

  message.channel.send({embed})
}

function showRoleList(bot, message, arg) {
  const { roles } = message.guild

  // Not using Object.keys as 'members' is a specialized: Collection<K, V>
  const flakes = roles.keyArray()

  const embed = new RichEmbed()
    .setTitle('6v6 - Roles')
    .setColor(0xA94AE8)
    .setTimestamp()

  const maxPage = Math.ceil(Math.max(flakes.length / ROLES_PER_PAGE, 1))
  const page = Math.max(Math.min(Number(arg) || 1, maxPage), 1)

  embed.setFooter('page ' + page + ' of ' + maxPage, 'https://cdn.discordapp.com/embed/avatars/0.png')

  const lastRole = Math.min(page * ROLES_PER_PAGE, flakes.length)
  for (let i = (page - 1) * ROLES_PER_PAGE; i < lastRole; i++) {
    const role = roles.get(flakes[i])
    embed.addField('`' + role.id + '`', '`' + utils.sanitizeCode(role.name) + '`', true)
  }

  message.channel.send({embed})
}

export default function load({registerCommand: register, permissions}) {
  permissions.registerPermission(PERM_PERMISSIONS, 'Allows managing permissions using the !perm command')

  register('perm', {
    desc: 'Manages permisions',
    extra: `Syntax: **perm** <action>
**perm list** [<page>]
**perm grant|revoke role|user** <permission_node>|(list [<page>])
**perm clear role|user** <id>|all
**perm show** <permission_node>
**perm show user|role** <id> [<page>]
`
  }, (bot, message, args) => {
    permissions.checkPermission(message, PERM_PERMISSIONS)
      .then((granted) => {
        if (granted) {
          const action = args[0]

          permissions.getPermissions().then((permNodes) => {
            if (permNodes.size === 0) {
              console.log('No permissions registered?')
              return
            }

            if (action === 'list') {

              const permNodeKeys = [...permNodes.keys()]

              const embed = new RichEmbed()
                .setTitle('6v6 - Permissions')
                .setColor(0xA94AE8)
                .setTimestamp()

              const maxPage = Math.ceil(Math.max(permNodes.size / PERMS_PER_PAGE, 1))
              const page = Math.max(Math.min(Number(args[1]) || 1, maxPage), 1)

              embed.setFooter('page ' + page + ' of ' + maxPage, 'https://cdn.discordapp.com/embed/avatars/0.png')

              const lastPermNode = Math.min(page * PERMS_PER_PAGE, permNodes.size)
              for (let i = (page - 1) * PERMS_PER_PAGE; i < lastPermNode; i++) {
                const permNode = permNodes.get(permNodeKeys[i])
                embed.addField('`' + permNode.node + '`', permNode.helpText, false)
              }

              message.channel.send({embed})

            } else if (action === 'grant' || action == 'revoke') {

              const target = args[1]
              const target2 = args[2]

              if (target === 'user') {

                if (target2 === 'list') {
                  showUserList(bot, message, args, args[3])
                } else {
                  const permission = args[3]

                  const { members } = message.guild

                  // Check if the member ID is valid
                  const memberTarget = members.get(target2)
                  if (memberTarget != null) {

                    // Check if the permission node actually exists
                    if (permNodes.has(permission)) {
                      if (action === 'grant') {

                        permissions.grantPermission(message.guild, memberTarget, permission)
                          .then(({result}) => {

                            if (result.nModified === 1 && result.ok === 1) {
                              message.channel.send(`User \`${utils.sanitizeCode(memberTarget.displayName)}\` has already been granted the \`${utils.sanitizeCode(permission)}\` permission`)
                            } else if (result.nModified === 0 && result.ok === 1) {
                              message.channel.send(`Granted permission \`${utils.sanitizeCode(permission)}\` for user \`${utils.sanitizeCode(memberTarget.displayName)}\``)
                            } else {
                              console.log('GRANT PERMISSION RESULT ERROR', result)
                              message.channel.send('An error occured while trying to grant user permission (unknown result)')
                            }

                          }, () => {
                            console.log('GRANT PERMISSION ERROR', err)
                            message.channel.send('An error occured while trying to grant user permission')
                          })

                      } else { // action === 'Revoke'

                        permissions.revokePermission(message.guild, memberTarget, permission)
                          .then(({result}) => {

                            if (result.n === 0 && result.ok === 1) {
                              message.channel.send(`User \`${utils.sanitizeCode(memberTarget.displayName)}\` doesn't have the \`${utils.sanitizeCode(permission)}\` permission`)
                            } else if (result.n > 0 && result.ok === 1) {
                              message.channel.send(`Revoked permission \`${utils.sanitizeCode(permission)}\` for user \`${utils.sanitizeCode(memberTarget.displayName)}\``)
                            } else {
                            console.log('REVOKE PERMISSION RESULT ERROR', result)
                              message.channel.send('An error occured while trying to revoke user permission (unknown result)')
                            }

                          }, (err) => {
                            console.log('REVOKE PERMISSION ERROR', err)
                            message.channel.send('An error occured while trying to revoke user permission')
                          })

                      }
                    } else {
                      message.channel.send(MSG_INVALID_PERMISSION)
                    }

                  } else {
                    message.channel.send(MSG_INVALID_TARGET_NAME)
                  }
                }

              } else if (target === 'role') {

                if (target2 === 'list') {
                  showRoleList(bot, message, args, args[3])
                } else {
                  const permission = args[3]

                  const { members } = message.guild

                  // Check if the member ID is valid
                  const memberTarget = members.get(target2)
                  if (memberTarget != null) {

                    // Check if the permission node actually exists
                    if (permNodes.has(permission)) {
                      permissions.grantPermission(message.guild, memberTarget, permission)
                        .then(({result}) => {

                          if (result.nModified === 1 && result.ok === 1) {
                            message.channel.send(`User \`${utils.sanitizeCode(memberTarget.displayName)}\` has already been granted the \`${utils.sanitizeCode(permission)}\` permission`)
                          } else if (result.nModified === 0 && result.ok === 1) {
                            message.channel.send(`Granted permission \`${utils.sanitizeCode(permission)}\` for user \`${utils.sanitizeCode(memberTarget.displayName)}\``)
                          } else {
                            message.channel.send('An error occured while trying to grant user permission (unknown result)')
                          }

                        }, () => {
                          message.channel.send('An error occured while trying to grant user permission')
                        })
                    } else {
                      message.channel.send(MSG_INVALID_PERMISSION)
                    }

                  } else {
                    message.channel.send(MSG_INVALID_TARGET_NAME)
                  }
                }

              } else {
                message.channel.send(MSG_INVALID_TARGET_NAME)
              }

            } else if (action === 'clear') {
            } else {
              message.channel.send('Invalid action name, check `!help perm` for the usage information')
            }
          })
        } else {
          message.channel.send('You don\'t have permission to manage permissions')
        }
      })
  })
}
