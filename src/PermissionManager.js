const PERM_OWNERSHIP = '$ownership'

export default function(db, bot) {
  const permissions = [{
    node: PERM_OWNERSHIP,
    helpText: 'Special permission that bypasses all permission checks'
  }]
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

  permissionsApi.grantPermission = (...args) => {
    let guild = args[0]
    let user = args[1]
    let node = args[2]

    if (args.length < 3) {
      guild = args[0].guild
      user = args[0].author
      node = args[1]
    }

    return new Promise((resolve, reject) => {
      permissionsDb.insert({ guildId: guild.id, userId: user.id, node }, (err) => {
        if (err) {
          console.log('grantPermission DB ERROR', err)

          reject()

          return
        }

        resolve()
      })
    })
  }

  permissionsApi.revokePermission = (...args) => {
    let guild = args[0]
    let user = args[1]
    let node = args[2]

    if (args.length < 3) {
      guild = args[0].guild
      user = args[0].author
      node = args[1]
    }

    return new Promise((resolve, reject) => {
      permissionsDb.remove({ guildId: guildId, userId: user.id, node }, { multi: true }, (err, numberRemoved) => {
        if (err) {
          console.log('revokePermission DB ERROR', err)

          reject()

          return
        }

        resolve(numberRemoved > 0)
      })
    })
  }

  permissionsApi.registerPermission = (node, helpText) => {
    permissions.push({node, helpText})
    return Promise.resolve(true)
  }

  permissionsApi.getPermissions = () => {
    return Promise.resolve(permissions)
  }

  return permissionsApi
}
