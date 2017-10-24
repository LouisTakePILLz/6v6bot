const PERM_OWNERSHIP = '$ownership'

export default function(db, bot) {
  const permissions = new Map()

  permissions.set(PERM_OWNERSHIP, {
    node: PERM_OWNERSHIP,
    helpText: 'Special permission that bypasses all permission checks'
  })

  const userPermissionsDb = db.collection('user_permissions')
  const rolePermissionsDb = db.collection('role_permissions')
  const permissionsCache = new Map()

  function updatePermissionsCache(guild) {
    let cache = permissionsCache.get(guild.id)
    if (cache == null) {
      cache = { roles: new Map() }
      permissionsCache.set(guild.id, cache)
    }

    return new Promise((resolve, reject) => {
      rolePermissionsDb.find({ guildId: guild.id }, (err, cur) => {
        if (err) {
          console.log('updatePermissionsCache - FAILED TO UPDATE PERMISSIONS CACHE - CACHE IS STALE - DB ERROR', err)
          reject(cache)
          return
        }

        cur.toArray((err, docs) => {
          cache.roles.clear()

          for (const [, role] of guild.roles) {
            const permissionsArray =
              (docs.filter(doc => doc.roleId === role.id) || [])
                .map(doc => doc.node)
            cache.roles.set(role.id, new Set(permissionsArray))
          }

          resolve(cache)
        })
      })
    })
  }

  function getPermissionsCache(guild) {
    return new Promise((resolve, reject) => {
      const cache = permissionsCache.get(guild.id)
      if (cache != null) {
        resolve(cache, false)
      } else {
        updatePermissionsCache(guild).then((cache) => {
          resolve(cache, true)
        }, (cache) => {
          console.log('getPermissionsCache - FAILED TO UPDATE CACHE')
          reject(cache)
        })
      }
    })
  }

  const permissionsApi = {}

  function extendPermissionPromise(guild, member, promise) {
    return Object.assign(promise, {
      and(node) {
        return extendPermissionPromise(guild, member, new Promise((resolve, reject) => {
          promise.then((result1) => {
            permissionsApi.checkPermission(guild, member, node).then((result2) => {
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
        return extendPermissionPromise(guild, member, new Promise((resolve, reject) => {
          promise.then((result1) => {
            if (result1) {
              resolve(true)
              return
            }
            permissionsApi.checkPermission(guild, member, node).then((result2) => {
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
    let member = args[1]
    let node = args[2]

    if (args.length < 3) {
      guild = args[0].channel.guild
      member = args[0].member
      node = args[1]
    }

    const promise = new Promise((resolve, reject) => {
      if (member.id === guild.owner.id) {
        resolve(true)
        return
      }
      userPermissionsDb.findOne({ guildId: guild.id, userId: member.id, node: { $in: [node, PERM_OWNERSHIP] } })
        .then((doc) => {
          // if doc is null, means the user doesn't own the permission node
          if (doc != null) {
            resolve(true)
            return
          }

          // check if the role owns the permission node
          getPermissionsCache(guild)
            .then((cache) => {
              for (const [, role] of member.roles) {
                const rolePermissions = cache.roles.get(role.id)

                //console.log('role', role)
                console.log('rolePermissions', rolePermissions)

                if (rolePermissions != null && rolePermissions.has(node)) {
                  resolve(true)
                  return
                }
              }
              resolve(false)
            }, /* onError */ () => {
              // deny access if the cache fails
              resolve(false)
            })
        }, /* onError */ (err) => {
          console.log('checkPermission DB ERROR', err)
          reject()
        })
    })

    return extendPermissionPromise(guild, member, promise)
  }

  permissionsApi.grantUserPermission = (guild, user, node) => {
    return new Promise((resolve, reject) => {
      const permissionQuery = { guildId: guild.id, userId: user.id, node }
      userPermissionsDb.update(permissionQuery, permissionQuery, { upsert: true })
        .then((e) => resolve(e), /* onError */ (err) => {
          console.log('grantUserPermission DB ERROR', err)
          reject()
        })
    })
  }

  permissionsApi.revokeUserPermission = (guild, user, node) => {
    return new Promise((resolve, reject) => {
      userPermissionsDb.remove({ guildId: guild.id, userId: user.id, node })
        .then((e) => resolve(e), /* onError*/ (err) => {
          console.log('revokeUserPermission DB ERROR', err)
          reject()
        })
    })
  }

  permissionsApi.grantRolePermission = (guild, role, node) => {
    return new Promise((resolve, reject) => {
      const permissionQuery = { guildId: guild.id, roleId: role.id, node }
      rolePermissionsDb.update(permissionQuery, permissionQuery, { upsert: true })
        .then((e) => {
          getPermissionsCache(guild)
            .then((cache, isNew) => {
              // If the cache is new, no need to update it manually
              if (isNew) {
                resolve(e)
                return
              }

              let permissionsSet = cache.roles.get(role.id)
              if (permissionsSet == null) {
                permissionsSet = new Set()
                cache.roles.set(role.id, permissionsSet)
              }

              permissionsSet.add(node)
              resolve(e)
            })
        }, /* onError */ (err) => {
          console.log('grantRolePermission DB ERROR', err)
          reject()
        })
    })
  }

  permissionsApi.revokeRolePermission = (guild, role, node) => {
    return new Promise((resolve, reject) => {
      rolePermissionsDb.remove({ guildId: guild.id, roleId: role.id, node })
        .then((e) => {
          getPermissionsCache(guild)
            .then((cache, isNew) => {
              // If the cache is new, no need to update it manually
              if (isNew) {
                resolve(e)
                return
              }

              let permissionsSet = cache.roles.get(role.id)
              if (permissionsSet == null) {
                permissionsSet = new Set()
                cache.roles.set(role.id, permissionsSet)
              }

              permissionsSet.delete(node)
              resolve(e)
            })
        }, /* onError */ (err) => {
          console.log('revokeRolePermission DB ERROR', err)
          reject()
        })
    })
  }

  permissionsApi.registerPermission = (node, helpText) => {
    permissions.set(node, { node, helpText })
    return Promise.resolve(true)
  }

  permissionsApi.getPermissions = () => {
    return Promise.resolve(permissions)
  }

  return permissionsApi
}
