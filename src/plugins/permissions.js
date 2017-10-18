import { RichEmbed } from 'discord.js'
import * as utils from '~/utils'

const PERM_PERMISSIONS = 'permissions'
const PERM_LIST_ROLES = 'list_roles'
const PERM_LIST_USERS = 'list_users'

const PERMS_PER_PAGE = 5
const USERS_PER_PAGE = 9
const ROLES_PER_PAGE = 9

const MSG_INVALID_TARGET_NAME = 'Invalid target name, check `!help perm` for the usage information'
const MSG_INVALID_PERMISSION = 'Invalid permission, check `!perm list` to list the available permissions'

function showUserList(bot, message, arg) {
  message.guild.fetchMembers()

  const { members, memberCount } = message.guild

  // Not using Object.keys as 'members' is a specialized collection: Collection<K, V>
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
    embed.addField('`' + utils.sanitizeCode(member.displayName) + '`', '`' + member.id + '`',  true)
  }

  message.channel.send({embed})
}

function showRoleList(bot, message, arg) {
  const { roles } = message.guild

  // Not using Object.keys as 'members' is a specialized collection: Collection<K, V>
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
    embed.addField('`' + utils.sanitizeCode(role.name) + '`', '`' + role.id + '`', true)
  }

  message.channel.send({embed})
}

function grantUserPermission(env, message, memberId, permission) {
  const { bot, permNodes, api: { permissions } } = env
  const { members } = message.guild

  // Check if the member ID is valid
  const memberTarget = members.get(memberId)
  if (memberTarget != null) {

    // Check if the permission node actually exists
    if (permNodes.has(permission)) {

      permissions.grantUserPermission(message.guild, memberTarget, permission)
        .then(({result}) => {

          if (result.nModified === 1 && result.ok === 1) {
            message.channel.send(`User \`${utils.sanitizeCode(memberTarget.displayName)}\` has already been granted the \`${utils.sanitizeCode(permission)}\` permission`)
          } else if (result.nModified === 0 && result.ok === 1) {
            message.channel.send(`Granted permission \`${utils.sanitizeCode(permission)}\` for user \`${utils.sanitizeCode(memberTarget.displayName)}\``)
          } else {
            console.log('GRANT PERMISSION RESULT ERROR', result)
            message.channel.send('An error occured while trying to grant user permission (unknown result)')
          }

        }, (err) => {
          console.log('GRANT PERMISSION ERROR', err)
          message.channel.send('An error occured while trying to grant user permission')
        })

    } else {
      message.channel.send(MSG_INVALID_PERMISSION)
    }

  } else {
    message.channel.send(MSG_INVALID_TARGET_NAME)
  }
}

function revokeUserPermission(env, message, memberId, permission) {
  const { bot, permNodes, api: { permissions } } = env
  const { members } = message.guild

  // Check if the member ID is valid
  const memberTarget = members.get(memberId)
  if (memberTarget != null) {

    // Check if the permission node actually exists
    if (permNodes.has(permission)) {

      permissions.revokeUserPermission(message.guild, memberTarget, permission)
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

    } else {
      message.channel.send(MSG_INVALID_PERMISSION)
    }

  } else {
    message.channel.send(MSG_INVALID_TARGET_NAME)
  }
}

function grantRolePermission(env, message, roleId, permission) {
  const { bot, permNodes, api: { permissions } } = env
  const { roles } = message.guild

  // Check if the role ID is valid
  const roleTarget = roles.get(roleId)
  if (roleTarget != null) {

    // Check if the permission node actually exists
    if (permNodes.has(permission)) {

      permissions.grantRolePermission(message.guild, roleTarget, permission)
        .then(({result}) => {

          if (result.nModified === 1 && result.ok === 1) {
            message.channel.send(`Role \`${utils.sanitizeCode(roleTarget.name)}\` has already been granted the \`${utils.sanitizeCode(permission)}\` permission`)
          } else if (result.nModified === 0 && result.ok === 1) {
            message.channel.send(`Granted permission \`${utils.sanitizeCode(permission)}\` for role \`${utils.sanitizeCode(roleTarget.name)}\``)
          } else {
            console.log('GRANT PERMISSION RESULT ERROR', result)
            message.channel.send('An error occured while trying to grant role permission (unknown result)')
          }

        }, (err) => {
          console.log('GRANT PERMISSION ERROR', err)
          message.channel.send('An error occured while trying to grant role permission')
        })

    } else {
      message.channel.send(MSG_INVALID_PERMISSION)
    }

  } else {
    message.channel.send(MSG_INVALID_TARGET_NAME)
  }
}

function revokeRolePermission(env, message, roleId, permission) {
  const { bot, permNodes, api: { permissions } } = env
  const { roles } = message.guild

  // Check if the role ID is valid
  const roleTarget = roles.get(roleId)
  if (roleTarget != null) {

    // Check if the permission node actually exists
    if (permNodes.has(permission)) {

      permissions.revokeRolePermission(message.guild, roleTarget, permission)
        .then(({result}) => {

          if (result.n === 0 && result.ok === 1) {
            message.channel.send(`Role \`${utils.sanitizeCode(roleTarget.name)}\` doesn't have the \`${utils.sanitizeCode(permission)}\` permission`)
          } else if (result.n > 0 && result.ok === 1) {
            message.channel.send(`Revoked permission \`${utils.sanitizeCode(permission)}\` for role \`${utils.sanitizeCode(roleTarget.name)}\``)
          } else {
            console.log('REVOKE PERMISSION RESULT ERROR', result)
            message.channel.send('An error occured while trying to revoke role permission (unknown result)')
          }

        }, (err) => {
          console.log('REVOKE PERMISSION ERROR', err)
          message.channel.send('An error occured while trying to clear role permissions')
        })

    } else {
      message.channel.send(MSG_INVALID_PERMISSION)
    }

  } else {
    message.channel.send(MSG_INVALID_TARGET_NAME)
  }
}

function clearUserPermissions(env, message, memberId) {
  const { bot, permNodes, api: { permissions } } = env
  const { guild } = message
  const { members } = guild

  // Check if the member ID is valid
  const memberTarget = members.get(memberId)
  if (memberTarget != null) {

    env.api.db.collection('user_permissions').deleteMany({ guildId: guild.id, userId: memberId, node: { $exists: true } })
      .then(({result}) => {

        if (result.ok === 1) {
          message.channel.send(`Revoked all permissions for user \`${utils.sanitizeCode(memberTarget.displayName)}\``)
        } else {
          console.log('CLEAR USER PERMISSIONS RESULT ERROR', result)
          message.channel.send('An error occured while trying to clear user permissions (unknown result)')
        }

      }, (err) => {
        console.log('clearUserPermissions ERROR', err)
        message.channel.send('An error occured while trying to clear user permissions')
      })

  } else {
    message.channel.send(MSG_INVALID_TARGET_NAME)
  }
}

function clearRolePermissions(env, message, roleId) {
  const { bot, permNodes, api: { permissions } } = env
  const { guild } = message
  const { roles } = guild

  // Check if the role ID is valid
  const roleTarget = roles.get(roleId)
  if (roleTarget != null) {

    env.api.db.collection('role_permissions').deleteMany({ guildId: guild.id, roleId, node: { $exists: true } })
      .then(({result}) => {

        if (result.ok === 1) {
          message.channel.send(`Revoked all permissions for role \`${utils.sanitizeCode(roleTarget.name)}\``)
        } else {
          console.log('CLEAR ROLE PERMISSIONS RESULT ERROR', result)
          message.channel.send('An error occured while trying to clear role permissions (unknown result)')
        }

      }, /* onError*/ (err) => {
        console.log('clearRolePermissions DB ERROR', err)
      })

  } else {
    message.channel.send(MSG_INVALID_TARGET_NAME)
  }
}

export default function load(api) {
  const { registerCommand: register, permissions } = api

  permissions.registerPermission(PERM_PERMISSIONS, 'Allows managing permissions using the !perm command (also allows using !roles and !users)')
  permissions.registerPermission(PERM_LIST_ROLES, 'Allows listing roles using the !roles command')
  permissions.registerPermission(PERM_LIST_USERS, 'Allows listing users using the !users command')

  register('roles', {
    desc: 'Lists roles and their snowflake identifiers (`flake_id`), useful for configuring permissions'
  }, (bot, message, args) => {
    permissions.checkPermission(message, PERM_PERMISSIONS).or(PERM_LIST_ROLES)
      .then((granted) => {
        if (granted) {
          showRoleList(bot, message, args[0])
        } else {
          message.channel.send('You don\'t have permission to list roles')
        }
      })
  })

  register('users', {
    desc: 'Lists users and their snowflake identifiers (`flake_id`), useful for configuring permissions'
  }, (bot, message, args) => {
    permissions.checkPermission(message, PERM_PERMISSIONS).or(PERM_LIST_USERS)
      .then((granted) => {
        if (granted) {
          showUserList(bot, message, args[0])
        } else {
          message.channel.send('You don\'t have permission to list users')
        }
      })
  })

  register('perm', {
    desc: 'Manages permisions',
    extra: `Syntax: **perm** <action>
**perm list** [<page>]
**perm grant|revoke role|user** <permission_node>
**perm clear role|user** <flake_id>
**perm show** <permission_node>
**perm show user|role** <flake_id> [<page>]`
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

            const env = { bot, permNodes, api }

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

            } else if (action === 'grant') {

              if (args[1] === 'user') {
                grantUserPermission(env, message, args[2], args[3])
              } else if (args[1] == 'role') {
                grantRolePermission(env, message, args[2], args[3])
              } else {
                message.channel.send(MSG_INVALID_TARGET_NAME)
              }

            } else if (action === 'revoke') {

              if (args[1] === 'user') {
                revokeUserPermission(env, message, args[2], args[3])
              } else if (args[1] == 'role') {
                revokeRolePermission(env, message, args[2], args[3])
              } else {
                message.channel.send(MSG_INVALID_TARGET_NAME)
              }

            } else if (action === 'clear') {

              if (args[1] === 'user') {
                clearUserPermissions(env, message, args[2])
              } else if (args[1] === 'role') {
                clearRolePermissions(env, message, args[2])
              } else {
                message.channel.send(MSG_INVALID_TARGET_NAME)
              }

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
