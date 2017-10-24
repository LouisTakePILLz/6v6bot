import { RichEmbed } from 'discord.js'
import * as utils from '~/utils'

const COMMANDS_PER_PAGE = 5

export default function load({registerCommand: register, getCommands}) {
  register('help', {
    desc: 'Displays the available commands and their purpose. If a command name is specified, specific help information will be displayed',
    adv: 'Displays the available commands and their purpose.\n...what else did you expect?',
    extra: '**help** [<page>]\n**help** <command>'
  }, (bot, message, args) => {
    const embed = new RichEmbed()
      .setColor(0xA94AE8)
      .setTimestamp()

    const commands = getCommands()
    const commandNames = [...commands.keys()]

    if (commandNames.size === 0) {
      console.log('No commands?')
      return
    }

    if (!utils.isNullOrWhitespace(args[0]) && Number.isNaN(Number(args[0]))) {
      // normalize the command name and get rid of the exclamation point
      let commandName = args[0].toLowerCase().trim()
      if (commandName.indexOf('!') === 0) {
        commandName = commandName.substring(1)
      }

      const command = commands.get(commandName)

      if (command == null) {
        message.channel.send(`Can't display help for unknown command \`${utils.sanitizeCode(commandName)}\``)
        return
      }

      embed
        .setTitle(`6v6 - Help: \`${utils.sanitizeCode(commandName)}\``)
        .setFooter('Command info', 'https://cdn.discordapp.com/embed/avatars/0.png')
        .addField('__**Description**__', command.helpInfo.adv || command.helpInfo.desc, false)

      if (command.helpInfo.perm != null) {
        embed.addField('__**Permissions**__', command.helpInfo.perm, false)
      }

      if (command.helpInfo.extra != null) {
        embed.addField('__**Synopsis**__', command.helpInfo.extra, false)
      }

      message.channel.send({embed})
    } else {
      embed.setTitle('6v6 - Help')

      const maxPage = Math.ceil(Math.max(commandNames.length / COMMANDS_PER_PAGE, 1))
      const page = Math.max(Math.min(Number(args[0]) || 1, maxPage), 1)

      embed.setFooter('Page ' + page + ' of ' + maxPage, 'https://cdn.discordapp.com/embed/avatars/0.png')

      const lastCommand = Math.min(page * COMMANDS_PER_PAGE, commandNames.length)
      for (let i = (page - 1) * COMMANDS_PER_PAGE; i < lastCommand; i++) {
        const commandName = commandNames[i]
        const command = commands.get(commandName)
        embed.addField('!' + commandName, command.helpInfo.desc, false)
      }

      message.channel.send({embed})
    }
  })
}
