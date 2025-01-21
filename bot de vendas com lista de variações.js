const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel],
});

const mercadoPagoToken = 'YOUR_MERCADO_PAGO_ACCESS_TOKEN';
const products = [
  { id: 1, name: 'Camisa', price: 100, deliveryMessage: 'Aqui está sua Camisa na cor escolhida: [link]' },
];

client.on('ready', () => {
  console.log(`Bot logged in as ${client.user.tag}`);
  sendProductMessage();
});

async function sendProductMessage() {
  const guild = client.guilds.cache.first();
  const channel = guild.channels.cache.find(ch => ch.name === 'general'); // Substitua pelo nome do canal onde deseja enviar a mensagem

  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
      .setCustomId('buy_shirt')
      .setLabel('Comprar Camisa')
      .setStyle(ButtonStyle.Primary)
    );

  const embed = new EmbedBuilder()
    .setTitle('Produtos Disponíveis')
    .setDescription('Clique no botão abaixo para comprar uma camisa.')
    .setColor('BLUE')
    .setTimestamp();

  channel.send({ embeds: [embed], components: [row] });
}

client.on('interactionCreate', async interaction => {
  if (interaction.isButton() && interaction.customId === 'buy_shirt') {
    const row = new ActionRowBuilder()
      .addComponents(
        new StringSelectMenuBuilder()
        .setCustomId('select_shirt_color')
        .setPlaceholder('Escolha a cor da camisa')
        .addOptions([
          {
            label: 'Vermelho',
            description: 'Camisa Vermelha',
            value: 'vermelho',
                        },
          {
            label: 'Azul',
            description: 'Camisa Azul',
            value: 'azul',
                        },
          {
            label: 'Verde',
            description: 'Camisa Verde',
            value: 'verde',
                        },
                    ])
      );

    await interaction.reply({
      content: 'Por favor, escolha a cor da camisa:',
      components: [row],
      ephemeral: true,
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'select_shirt_color') {
    const selectedColor = interaction.values[0];
    const product = products.find(p => p.id === 1);

    if (product) {
      const paymentLink = await createPaymentLink(product, selectedColor, interaction.user.id);
      const embed = new EmbedBuilder()
        .setTitle(`Compra de ${product.name}`)
        .setDescription(`Você escolheu a cor: ${selectedColor}\nClique [aqui](${paymentLink}) para pagar.`)
        .setColor('GREEN')
        .setTimestamp();

      interaction.update({
        content: '',
        embeds: [embed],
        components: [],
        ephemeral: true,
      });
    }
  }
});

async function createPaymentLink(product, selectedColor, buyerDiscordId) {
  try {
    const response = await axios.post('https://api.mercadopago.com/checkout/preferences', {
      items: [
        {
          title: `${product.name} (${selectedColor})`,
          quantity: 1,
          currency_id: 'BRL',
          unit_price: product.price
                }
            ],
      payer: {
        email: `${buyerDiscordId}@example.com` // Substitua com o e-mail do comprador, se disponível
      },
      notification_url: 'YOUR_NOTIFICATION_URL', // Substitua pela URL de notificação
      external_reference: buyerDiscordId
    }, {
      headers: {
        Authorization: `Bearer ${mercadoPagoToken}`
      }
    });

    return response.data.init_point;
  } catch (error) {
    console.error('Erro ao criar link de pagamento:', error);
    return null;
  }
}

// Servidor para receber notificações do Mercado Pago
const app = express();
app.use(bodyParser.json());

app.post('/mercadopago-notifications', async (req, res) => {
  const { type, data } = req.body;

  if (type === 'payment') {
    const paymentId = data.id;
    const payment = await getPaymentStatus(paymentId);

    if (payment && payment.status === 'approved') {
      const buyerDiscordId = payment.external_reference;
      const productId = payment.additional_info.items[0].id;
      const selectedColor = payment.additional_info.items[0].title.split(' ')[1];

      const product = products.find(p => p.id === productId);
      if (product) {
        const buyer = await client.users.fetch(buyerDiscordId);
        if (buyer) {
          buyer.send(`${product.deliveryMessage.replace('[link]', 'Link para download/entrega do produto')} na cor ${selectedColor}.`);
        }
      }
    }
  }

  res.sendStatus(200);
});

async function getPaymentStatus(paymentId) {
  try {
    const response = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${mercadoPagoToken}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Erro ao obter status do pagamento:', error);
    return null;
  }
}

client.login(process.env.DISCORD_BOT_TOKEN);
app.listen(3000, () => console.log('Servidor de notificações do Mercado Pago rodando na porta 3000'));