const PERM_OWNERSHIP = '$ownership'

export default function(db, bot) {
  const permissions = new Map()

  permissions.set(PERM_OWNERSHIP, {
    node: PERM_OWNERSHIP,
    helpText: 'Special permission that bypasses all permission checks'
  })

  const permissionsDb = db.collection('permissions')

  const permissionsApi = {}

  function extendPermissionPromise(guild, user, promise) {
    return Object.assign(promise, {
      and(node) {
        return extendPermissionPromise(guild, user, new Promise((resolve, reject) => {
          promise.then((result1) => {
            permissionsApi.checkPermission(guild, user, node).then((result2) => {
              if (result1 && result2) {
                resolve(true)
              } else {
                resolve(false)
              }
            })
          })
        }))
      },
      or(node) {
        return extendPermissionPromise(guild, user, new Promise((resolve, reject) => {
          promise.then((result1) => {
            if (result1) {
              resolve(true)
              return
            }
            permissionsApi.checkPermission(guild, user, node).then((result2) => {
              if (result2) {
                resolve(true)
              } else {
                resolve(false)
              }
            })
          })
        }))
      }
    })
  }

  permissionsApi.checkPermission = (...args) => {
    let guild = args[0]
    let user = args[1]
    let node = args[2]

    if (args.length < 3) {
      guild = args[0].channel.guild
      user = args[0].author
      node = args[1]
    }

    const promise = new Promise((resolve, reject) => {
      if (user.id === guild.owner.id) {
        resolve(true)
        return
      }
      permissionsDb.findOne({ guildId: guild.id, userId: user.id, node: { $in: [node, PERM_OWNERSHIP] } }, (err, doc) => {
        if (err) {
          console.log('checkPermission DB ERROR', err)

          reject()

          return
        }

        // if doc is null, means the user doesn't own the permission node
        resolve(doc != null)
      })
    })

    return extendPermissionPromise(guild, user, promise)
  }

  permissionsApi.grantUserPermission = (guild, user, node) => {
    return new Promise((resolve, reject) => {
      const permissionQuery = { guildId: guild.id, userId: user.id, node }
      permissionsDb.update(permissionQuery, permissionQuery, { upsert: true })
        .then((e) => resolve(e), /* onError */ (err) => {
          console.log('grantUserPermission DB ERROR', err)
          reject()
        })
    })
  }

  permissionsApi.revokeUserPermission = (guild, user, node) => {
    return new Promise((resolve, reject) => {
      permissionsDb.remove({ guildId: guild.id, userId: user.id, node })
        .then((e) => resolve(e), /* onError*/ (err) => {
          console.log('revokeUserPermission DB ERROR', err)
          reject()
        })
    })
  }

  permissionsApi.grantRolePermission = (guild, role, node) => {
    return new Promise((resolve, reject) => {
      const permissionQuery = { guildId: guild.id, roleId: role.id, node }
      permissionsDb.update(permissionQuery, permissionQuery, { upsert: true })
        .then((e) => resolve(e), /* onError */ (err) => {
          console.log('grantRolePermission DB ERROR', err)
          reject()
        })
    })
  }

  permissionsApi.revokeRolePermission = (guild, role, node) => {
    return new Promise((resolve, reject) => {
      permissionsDb.remove({ guildId: guild.id, roleId: role.id, node })
        .then((e) => resolve(e), /* onError*/ (err) => {
          console.log('revokeRolePermission DB ERROR', err)
          reject()
        })
    })
  }

  permissionsApi.registerPermission = (node, helpText) => {
    permissions.set(node, {node, helpText})
    return Promise.resolve(true)
  }

  permissionsApi.getPermissions = () => {
    return Promise.resolve(permissions)
  }

  return permissionsApi
}
