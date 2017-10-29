import { RichEmbed } from 'discord.js'
import * as constants from '~/constants'
import * as utils from '~/utils'

const PERMS_PER_PAGE = 5
const USERS_PER_PAGE = 9
const ROLES_PER_PAGE = 9

const MSG_INVALID_TARGET_NAME = 'Invalid target name, check `help perm` for the usage information'
const MSG_INVALID_PERMISSION = 'Invalid permission, check `perm list` to list the available permissions'

function showUserList(bot, message, arg) {
  message.guild.fetchMembers()

  const { members } = message.guild

  // Not using Object.keys as 'members' is a specialized collection: Collection<K, V>
  const flakes = members.keyArray()

  const embed = new RichEmbed()
    .setTitle('6v6 - Users')
    .setColor(constants.EMBED_COLOR)
    .setTimestamp()

  const maxPage = Math.ceil(Math.max(flakes.length / USERS_PER_PAGE, 1))
  const page = Math.max(Math.min(Number(arg) || 1, maxPage), 1)

  embed.setFooter(`Page ${page} of ${maxPage}`, 'https://cdn.discordapp.com/embed/avatars/0.png')

  const lastMember = Math.min(page * USERS_PER_PAGE, flakes.length)
  for (let i = (page - 1) * USERS_PER_PAGE; i < lastMember; i++) {
    const member = members.get(flakes[i])
    embed.addField('`' + utils.sanitizeCode(member.displayName) + '`', '`' + member.id + '`', true)
  }

  message.channel.send({ embed })
}

function showRoleList(bot, message, arg) {
  const { roles } = message.guild

  // Not using Object.keys as 'members' is a specialized collection: Collection<K, V>
  const flakes = roles.keyArray()

  const embed = new RichEmbed()
    .setTitle('6v6 - Roles')
    .setColor(constants.EMBED_COLOR)
    .setTimestamp()

  const maxPage = Math.ceil(Math.max(flakes.length / ROLES_PER_PAGE, 1))
  const page = Math.max(Math.min(Number(arg) || 1, maxPage), 1)

  embed.setFooter(`Page ${page} of ${maxPage}`, 'https://cdn.discordapp.com/embed/avatars/0.png')

  const lastRole = Math.min(page * ROLES_PER_PAGE, flakes.length)
  for (let i = (page - 1) * ROLES_PER_PAGE; i < lastRole; i++) {
    const role = roles.get(flakes[i])
    embed.addField('`' + utils.sanitizeCode(role.name) + '`', '`' + role.id + '`', true)
  }

  message.channel.send({ embed })
}

async function grantUserPermission({ permNodes, api: { permissions } }, message, memberId, permission) {
  const { members } = message.guild

  // Check if the member ID is valid
  const targetMember = members.get(memberId)
  if (targetMember != null) {
    // Check if the permission node actually exists
    if (permNodes.has(permission)) {
      try {
        const { result } = await permissions.grantUserPermission(message.guild, targetMember, permission)

        if (result.nModified === 1 && result.ok === 1) {
          message.channel.send(`User \`${utils.sanitizeCode(targetMember.displayName)}\` has already been granted the \`${utils.sanitizeCode(permission)}\` permission`)
        } else if (result.nModified === 0 && result.ok === 1) {
          message.channel.send(`Granted permission \`${utils.sanitizeCode(permission)}\` for user \`${utils.sanitizeCode(targetMember.displayName)}\``)
        } else {
          console.log('GRANT PERMISSION RESULT ERROR', result)
          message.channel.send('An error occured while trying to grant user permission (unknown result)')
        }
      } catch (err) {
        message.channel.send('An error occured while trying to grant user permission')
      }
    } else {
      message.channel.send(MSG_INVALID_PERMISSION)
    }
  } else {
    message.channel.send(MSG_INVALID_TARGET_NAME)
  }
}

async function revokeUserPermission({ permNodes, api: { permissions } }, message, memberId, permission) {
  const { members } = message.guild

  // TODO: check if the member is part of the server only after trying to revoke the permission?
  //       we still want to be able to manage user permissions after they leave the server
  // Check if the member ID is valid
  const targetMember = members.get(memberId)
  if (targetMember != null) {
    // Check if the permission node actually exists
    if (permNodes.has(permission)) {
      const { result } = await permissions.revokeUserPermission(message.guild, targetMember, permission)
      try {
        if (result.n === 0 && result.ok === 1) {
          message.channel.send(`User \`${utils.sanitizeCode(targetMember.displayName)}\` doesn't have the \`${utils.sanitizeCode(permission)}\` permission`)
        } else if (result.n > 0 && result.ok === 1) {
          message.channel.send(`Revoked permission \`${utils.sanitizeCode(permission)}\` for user \`${utils.sanitizeCode(targetMember.displayName)}\``)
        } else {
          console.log('REVOKE PERMISSION RESULT ERROR', result)
          message.channel.send('An error occured while trying to revoke user permission (unknown result)')
        }
      } catch (err) {
        message.channel.send('An error occured while trying to revoke user permission')
      }
    } else {
      message.channel.send(MSG_INVALID_PERMISSION)
    }
  } else {
    message.channel.send(MSG_INVALID_TARGET_NAME)
  }
}

async function grantRolePermission({ permNodes, api: { permissions } }, message, roleId, permission) {
  const { roles } = message.guild

  // Check if the role ID is valid
  const targetRole = roles.get(roleId)
  if (targetRole != null) {
    // Check if the permission node actually exists
    if (permNodes.has(permission)) {
      const { result } = await permissions.grantRolePermission(message.guild, targetRole, permission)
      try {
        if (result.nModified === 1 && result.ok === 1) {
          message.channel.send(`Role \`${utils.sanitizeCode(targetRole.name)}\` has already been granted the \`${utils.sanitizeCode(permission)}\` permission`)
        } else if (result.nModified === 0 && result.ok === 1) {
          message.channel.send(`Granted permission \`${utils.sanitizeCode(permission)}\` for role \`${utils.sanitizeCode(targetRole.name)}\``)
        } else {
          console.log('GRANT PERMISSION RESULT ERROR', result)
          message.channel.send('An error occured while trying to grant role permission (unknown result)')
        }
      } catch (err) {
        message.channel.send('An error occured while trying to grant role permission')
      }
    } else {
      message.channel.send(MSG_INVALID_PERMISSION)
    }
  } else {
    message.channel.send(MSG_INVALID_TARGET_NAME)
  }
}

async function revokeRolePermission({ permNodes, api: { permissions } }, message, roleId, permission) {
  const { roles } = message.guild

  // Check if the role ID is valid
  const targetRole = roles.get(roleId)
  if (targetRole != null) {
    // Check if the permission node actually exists
    if (permNodes.has(permission)) {
      const { result } = await permissions.revokeRolePermission(message.guild, targetRole, permission)
      try {
        if (result.n === 0 && result.ok === 1) {
          message.channel.send(`Role \`${utils.sanitizeCode(targetRole.name)}\` doesn't have the \`${utils.sanitizeCode(permission)}\` permission`)
        } else if (result.n > 0 && result.ok === 1) {
          message.channel.send(`Revoked permission \`${utils.sanitizeCode(permission)}\` for role \`${utils.sanitizeCode(targetRole.name)}\``)
        } else {
          console.log('REVOKE PERMISSION RESULT ERROR', result)
          message.channel.send('An error occured while trying to revoke role permission (unknown result)')
        }
      } catch (err) {
        message.channel.send('An error occured while trying to revoke role permission')
      }
    } else {
      message.channel.send(MSG_INVALID_PERMISSION)
    }
  } else {
    message.channel.send(MSG_INVALID_TARGET_NAME)
  }
}

async function clearUserPermissions({ api: { permissions } }, message, memberId) {
  const { guild } = message
  const { members } = guild

  // TODO: check if the member is part of the server only after trying to clear permissions?
  //       we still want to be able to manage user permissions after they leave the server
  // Check if the member ID is valid
  const targetMember = members.get(memberId)
  if (targetMember != null) {
    try {
      const { result } = await permissions.clearUserPermissions(guild, targetMember)
      if (result.ok === 1) {
        message.channel.send(`Revoked all permissions for user \`${utils.sanitizeCode(targetMember.displayName)}\``)
      } else {
        console.log('CLEAR USER PERMISSIONS RESULT ERROR', result)
        message.channel.send('An error occured while trying to clear user permissions (unknown result)')
      }
    } catch (err) {
      message.channel.send('An error occured while trying to clear user permissions')
    }
  } else {
    message.channel.send(MSG_INVALID_TARGET_NAME)
  }
}

async function clearRolePermissions({ api: { permissions } }, message, roleId) {
  const { guild } = message
  const { roles } = guild

  // Check if the role ID is valid
  const targetRole = roles.get(roleId)
  if (targetRole != null) {
    try {
      const { result } = await permissions.clearRolePermissions(guild, targetRole)
      if (result.ok === 1) {
        message.channel.send(`Revoked all permissions for role \`${utils.sanitizeCode(targetRole.name)}\``)
      } else {
        console.log('CLEAR ROLE PERMISSIONS RESULT ERROR', result)
        message.channel.send('An error occured while trying to clear role permissions (unknown result)')
      }
    } catch (err) {
      console.log('clearRolePermissions DB ERROR', err)
      message.channel.send('An error occured while trying to clear role permissions')
    }
  } else {
    message.channel.send(MSG_INVALID_TARGET_NAME)
  }
}

function showUserPermissions({ api: { db } }, message, memberId) {
  const { guild } = message
  const { members } = guild

  if (utils.isNullOrWhitespace(memberId)) {
    message.channel.send(MSG_INVALID_TARGET_NAME)
    return
  }

  db.collection('user_permissions').find({ guildId: guild.id, userId: memberId }, (err, cur) => {
    if (err) {
      console.log('showUserPermissions DB ERROR 1', err)
      message.channel.send('An error occured while trying to look up user permissions')
      return
    }

    cur.toArray((err, docs) => {
      if (err) {
        console.log('showUserPermissions DB ERROR 2', err)
        message.channel.send('An error occured while trying to fetch user permissions')
        return
      }

      // check whether the the provided memberId is part of this guild here
      // we still want to be able to manage user permissions after they leave the server
      const targetMember = members.get(memberId)
      if (docs.length === 0 && targetMember == null) {
        message.channel.send(MSG_INVALID_TARGET_NAME)
        return
      }

      const permissionList = docs.length === 0
        ? '*No permissions*'
        : docs.map(x => '`' + x.node + '`').join(', ')

      const embed = new RichEmbed()
        .setTitle(`6v6 - User permissions: ${utils.sanitizeCode(targetMember.displayName)}`)
        .setColor(constants.EMBED_COLOR)
        .setTimestamp()
        .setDescription('__**Permissions**__\n' + permissionList)

      message.channel.send({ embed })
    })
  })
}

function showRolePermissions({ api: { db } }, message, roleId) {
  const { guild } = message
  const { roles } = guild

  // Check if the role ID is valid
  const targetRole = roles.get(roleId)
  if (targetRole != null) {
    db.collection('role_permissions').find({ guildId: guild.id, roleId }, (err, cur) => {
      if (err) {
        console.log('showRolePermissions DB ERROR 1', err)
        message.channel.send('An error occured while trying to look up role permissions')
        return
      }

      cur.toArray((err, docs) => {
        if (err) {
          console.log('showRolePermissions DB ERROR 2', err)
          message.channel.send('An error occured while trying to fetch role permissions')
          return
        }

        const permissionList = docs.length === 0
          ? '*No permissions*'
          : docs.map(x => '`' + x.node + '`').join(', ')

        const embed = new RichEmbed()
          .setTitle(`6v6 - Role permissions: ${utils.sanitizeCode(targetRole.name)}`)
          .setColor(constants.EMBED_COLOR)
          .setTimestamp()
          .setDescription('__**Permissions**__\n' + permissionList)

        message.channel.send({ embed })
      })
    })
  } else {
    message.channel.send(MSG_INVALID_TARGET_NAME)
  }
}

export default function load(api) {
  const { registerCommand: register, permissions } = api

  permissions.registerPermission(constants.PERM_PERMISSIONS, 'Allows managing permissions using the `perm` command (also allows using `roles` and `users`)')
  permissions.registerPermission(constants.PERM_LISTING, 'Allows listing users and roles using the `users` and `roles` commands')

  register('roles', {
    desc: 'Lists roles and their snowflake identifiers (`flake_id`), useful for configuring permissions',
    perm: `Requires \`${constants.PERM_LISTING}\` or \`${constants.PERM_PERMISSIONS}\``
  }, async (bot, message, args) => {
    const granted = await permissions.checkPermission(message, constants.PERM_PERMISSIONS).or(constants.PERM_LISTING)
    if (granted) {
      showRoleList(bot, message, args[0])
    } else {
      message.channel.send('You don\'t have permission to list roles')
    }
  })

  register('users', {
    desc: 'Lists users and their snowflake identifiers (`flake_id`), useful for configuring permissions',
    perm: `Requires \`${constants.PERM_LISTING}\` or \`${constants.PERM_PERMISSIONS}\``
  }, async (bot, message, args) => {
    const granted = await permissions.checkPermission(message, constants.PERM_PERMISSIONS).or(constants.PERM_LISTING)
    if (granted) {
      showUserList(bot, message, args[0])
    } else {
      message.channel.send('You don\'t have permission to list users')
    }
  })

  register('perm', {
    desc: 'Manages permissions',
    perm: `Requires \`${constants.PERM_PERMISSIONS}\``,
    extra: `**perm** <action>
**perm list** [<page>]
**perm grant|revoke role|user** <flake_id> <permission_node>
**perm clear role|user** <flake_id>
**perm show user|role** <flake_id> [<page>]`
  }, async (bot, message, args) => {
    const granted = await permissions.checkPermission(message, constants.PERM_PERMISSIONS)
    if (granted) {
      const action = args[0]

      const permNodes = permissions.getPermissions()
      if (permNodes.size === 0) {
        console.log('No permissions registered?')
        return
      }

      const env = { bot, permNodes, api }

      if (action === 'list') {
        const permNodeKeys = [...permNodes.keys()]

        const embed = new RichEmbed()
          .setTitle('6v6 - Permissions')
          .setColor(constants.EMBED_COLOR)
          .setTimestamp()

        const maxPage = Math.ceil(Math.max(permNodes.size / PERMS_PER_PAGE, 1))
        const page = Math.max(Math.min(Number(args[1]) || 1, maxPage), 1)

        embed.setFooter(`Page ${page} of ${maxPage}`, 'https://cdn.discordapp.com/embed/avatars/0.png')

        const lastPermNode = Math.min(page * PERMS_PER_PAGE, permNodes.size)
        for (let i = (page - 1) * PERMS_PER_PAGE; i < lastPermNode; i++) {
          const permNode = permNodes.get(permNodeKeys[i])
          embed.addField('`' + permNode.node + '`', permNode.helpText, false)
        }

        message.channel.send({ embed })
      } else if (action === 'grant') {
        if (args[1] === 'user') {
          grantUserPermission(env, message, utils.resolveTargetId(args[2]), args[3])
        } else if (args[1] === 'role') {
          grantRolePermission(env, message, utils.resolveTargetId(args[2]), args[3])
        } else {
          message.channel.send(MSG_INVALID_TARGET_NAME)
        }
      } else if (action === 'revoke') {
        if (args[1] === 'user') {
          revokeUserPermission(env, message, utils.resolveTargetId(args[2]), args[3])
        } else if (args[1] === 'role') {
          revokeRolePermission(env, message, utils.resolveTargetId(args[2]), args[3])
        } else {
          message.channel.send(MSG_INVALID_TARGET_NAME)
        }
      } else if (action === 'clear') {
        if (args[1] === 'user') {
          clearUserPermissions(env, message, utils.resolveTargetId(args[2]))
        } else if (args[1] === 'role') {
          clearRolePermissions(env, message, utils.resolveTargetId(args[2]))
        } else {
          message.channel.send(MSG_INVALID_TARGET_NAME)
        }
      } else if (action === 'show') {
        if (args[1] === 'user') {
          showUserPermissions(env, message, utils.resolveTargetId(args[2]))
        } else if (args[1] === 'role') {
          showRolePermissions(env, message, utils.resolveTargetId(args[2]))
        } else {
          message.channel.send(MSG_INVALID_TARGET_NAME)
        }
      } else {
        message.channel.send('Invalid action name, check `help perm` for the usage information')
      }
    } else {
      message.channel.send('You don\'t have permission to manage permissions')
    }
  })
}
