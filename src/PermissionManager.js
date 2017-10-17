const PERM_OWNERSHIP = '$ownership'

export default function(db, bot) {
  const permissions = []
  const permissionsDb = db.collection('permissions')

  const permissionsApi = {}

  function extendPermissionPromise(server, user, promise) {
    return Object.assign(promise, {
      and(node) {
        return extendPermissionPromise(server, user, new Promise((resolve, reject) => {
          promise.then((result1) => {
            permissionsApi.checkPermission(server, user, node).then((result2) => {
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
        return extendPermissionPromise(server, user, new Promise((resolve, reject) => {
          promise.then((result1) => {
            if (result1) {
              resolve(true)
              return
            }
            permissionsApi.checkPermission(server, user, node).then((result2) => {
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
    let server = args[0]
    let user = args[1]
    let node = args[2]

    if (args.length < 3) {
      server = args[0].server
      user = args[0].author
      node = args[1]
    }

    const promise = new Promise((resolve, reject) => {
      permissionsDb.findOne({ serverId: server.id, userId: user.id, node: { $in: [node, PERM_OWNERSHIP] } }, (err, doc) => {
        if (err) {
          console.log('checkPermission DB ERROR', err)

          reject()

          return
        }

        // if doc is null, means the user doesn't own the permission node
        resolve(doc != null)
      })
    })

    return extendPermissionPromise(server, user, promise)
  }

  permissionsApi.grantPermission = (...args) => {
    let server = args[0]
    let user = args[1]
    let node = args[2]

    if (args.length < 3) {
      server = args[0].server
      user = args[0].author
      node = args[1]
    }

    return new Promise((resolve, reject) => {
      permissionsDb.insert({ serverId: server.id, userId: user.id, node }, (err) => {
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
    let server = args[0]
    let user = args[1]
    let node = args[2]

    if (args.length < 3) {
      server = args[0].server
      user = args[0].author
      node = args[1]
    }

    return new Promise((resolve, reject) => {
      permissionsDb.remove({ serverId: serverId, userId: user.id, node }, { multi: true }, (err, numberRemoved) => {
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
