import * as errors from '~/errors'

const PERM_OWNERSHIP = '$ownership'

function extendPermissionPromise(guild, member, promise) {
  const permissions = this

  return Object.assign(promise, {
    and(node) {
      return permissions::extendPermissionPromise(guild, member, new Promise((resolve, reject) => {
        promise.then((result1) => {
          permissions.checkPermission(guild, member, node).then((result2) => {
            if (result1 && result2) {
              resolve(true)
            } else {
              resolve(false)
            }
          })
        }, /* onError */ (err) => {
          console.log('extendPermissionPromise AND ERROR', err)
          reject(err)
        })
      }))
    },
    or(node) {
      return permissions::extendPermissionPromise(guild, member, new Promise((resolve, reject) => {
        promise.then((result1) => {
          if (result1) {
            resolve(true)
            return
          }
          permissions.checkPermission(guild, member, node).then((result2) => {
            if (result2) {
              resolve(true)
            } else {
              resolve(false)
            }
          })
        }, /* onError */ (err) => {
          console.log('extendPermissionPromise OR ERROR', err)
          reject(err)
        })
      }))
    }
  })
}

const PermissionManagerWrapper = ({ db }) => class PermissionManager {
  constructor() {
    this.permissions = new Map()
    this.permissions.set(PERM_OWNERSHIP, {
      node: PERM_OWNERSHIP,
      helpText: 'Special permission that bypasses all permission checks'
    })
    this.permissionsCache = new Map()
  }

  _updatePermissionsCache(guild) {
    const cache = { roles: new Map() }

    return new Promise((resolve) => {
      db.collection('role_permissions').find({ guildId: guild.id }, (err, cur) => {
        if (err) {
          console.log('_updatePermissionsCache - FAILED TO UPDATE PERMISSIONS CACHE - CACHE IS STALE - DB ERROR 1', err)
          resolve({ cache, isStale: true })
          return
        }

        cur.toArray((err, docs) => {
          if (err) {
            console.log('_updatePermissionsCache - FAILED TO UPDATE PERMISSIONS CACHE - CACHE IS STALE - DB ERROR 2', err)
            resolve({ cache, isStale: true })
            return
          }

          for (const [, role] of guild.roles) {
            const permissionsArray =
              (docs.filter(doc => doc.roleId === role.id) || [])
                .map(doc => doc.node)
            cache.roles.set(role.id, new Set(permissionsArray))
          }

          resolve({ cache, isStale: false })
        })
      })
    })
  }

  _getPermissionsCache(guild) {
    return new Promise((resolve, reject) => {
      const cache = this.permissionsCache.get(guild.id)
      if (cache != null) {
        resolve({ cache, isNew: false })
      } else {
        this._updatePermissionsCache(guild)
          .then(({ cache, isStale }) => {
            if (isStale) {
              this.permissionsCache.delete(guild.id)
            } else {
              this.permissionsCache.set(guild.id, cache)
            }

            resolve({ cache, isNew: true })
          }, (err) => {
            console.log('_getPermissionsCache - FAILED TO UPDATE CACHE')
            reject(err)
          })
      }
    })
  }

  checkPermission(...args) {
    let guild = args[0]
    let member = args[1]
    let node = args[2]

    if (args.length < 3) {
      /* eslint-disable */
      guild = args[0].channel.guild
      member = args[0].member
      node = args[1]
      /* eslint-enable */
    }

    const promise = new Promise((resolve, reject) => {
      if (member.id === guild.owner.id) {
        resolve(true)
        return
      }
      db.collection('user_permissions').findOne({ guildId: guild.id, userId: member.id, node: { $in: [node, PERM_OWNERSHIP] } })
        .then((doc) => {
          // if doc is null, means the user doesn't own the permission node
          if (doc != null) {
            resolve(true)
            return
          }

          // check if the role owns the permission node
          this._getPermissionsCache(guild)
            .then(({ cache }) => {
              for (const [, role] of member.roles) {
                const rolePermissions = cache.roles.get(role.id)

                //console.log('role', role)
                //console.log('rolePermissions', rolePermissions)

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
          reject(new errors.DbError(err))
        })
    })

    return this::extendPermissionPromise(guild, member, promise)
  }

  async grantUserPermission(guild, user, node) {
    const permissionQuery = { guildId: guild.id, userId: user.id, node }
    try {
      return await db.collection('user_permissions').update(permissionQuery, permissionQuery, { upsert: true })
    } catch (err) {
      console.log('grantUserPermission DB ERROR', err)
      throw new errors.DbError(err)
    }
  }

  async revokeUserPermission(guild, user, node) {
    try {
      return await db.collection('user_permissions').remove({ guildId: guild.id, userId: user.id, node })
    } catch (err) {
      console.log('revokeUserPermission DB ERROR', err)
      throw new errors.DbError(err)
    }
  }

  async clearUserPermissions(guild, user) {
    try {
      return await db.collection('user_permissions').deleteMany({ guildId: guild.id, userId: user.id, node: { $exists: true } })
    } catch (err) {
      console.log('clearUserPermissions DB ERROR', err)
      throw new errors.DbError(err)
    }
  }

  async grantRolePermission(guild, role, node) {
    const permissionQuery = { guildId: guild.id, roleId: role.id, node }
    let e
    try {
      e = await db.collection('role_permissions').update(permissionQuery, permissionQuery, { upsert: true })
    } catch (err) {
      console.log('grantRolePermission DB ERROR', err)
      throw new errors.DbError(err)
    }

    try {
      const { cache, isNew } = await this._getPermissionsCache(guild)

      // If the cache is new, no need to update it manually
      if (isNew) {
        return e
      }

      let permissionsSet = cache.roles.get(role.id)
      if (permissionsSet == null) {
        permissionsSet = new Set()
        cache.roles.set(role.id, permissionsSet)
      }

      permissionsSet.add(node)

      return e
    } catch (err) {
      console.log('grantRolePermission ERROR', err)
      throw err
    }
  }

  async revokeRolePermission(guild, role, node) {
    let e
    try {
      e = await db.collection('role_permissions').remove({ guildId: guild.id, roleId: role.id, node })
    } catch (err) {
      console.log('revokeRolePermission DB ERROR', err)
      throw new errors.DbError(err)
    }

    try {
      const { cache, isNew } = await this._getPermissionsCache(guild)

      // If the cache is new, no need to update it manually
      if (isNew) {
        return e
      }

      let permissionsSet = cache.roles.get(role.id)
      if (permissionsSet == null) {
        permissionsSet = new Set()
        cache.roles.set(role.id, permissionsSet)
      }

      permissionsSet.delete(node)

      return e
    } catch (err) {
      console.log('revokeRolePermission ERROR', err)
      throw err
    }
  }

  async clearRolePermissions(guild, role) {
    let e
    try {
      e = await db.collection('role_permissions').deleteMany({ guildId: guild.id, roleId: role.id, node: { $exists: true } })
    } catch (err) {
      console.log('clearRolePermissions DB ERROR', err)
      throw new errors.DbError(err)
    }

    try {
      const { cache, isNew } = await this._getPermissionsCache(guild)

      // If the cache is new, no need to update it manually
      if (isNew) {
        return e
      }

      let permissionsSet = cache.roles.get(role.id)
      if (permissionsSet == null) {
        permissionsSet = new Set()
        cache.roles.set(role.id, permissionsSet)
      }

      permissionsSet.clear()

      return e
    } catch (err) {
      console.log('clearRolePermissions ERROR', err)
      throw err
    }
  }

  registerPermission(node, helpText) {
    if (this.permissions.has(node)) {
      return false
    }

    this.permissions.set(node, { node, helpText })
    return true
  }

  getPermissions() {
    return this.permissions
  }
}

export default PermissionManagerWrapper
