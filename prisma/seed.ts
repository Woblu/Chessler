import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function seedCampaign() {
  // Deterministic “story” campaign. Order is unique, so we can upsert.
  const nodes: Array<
    Omit<Prisma.CampaignNodeCreateInput, 'progress'> & { order: number }
  > = [
    {
      order: 1,
      bossName: 'Coach Caro',
      bossElo: 700,
      bossAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Coach%20Caro',
      pawnReward: 10,
    },
    {
      order: 2,
      bossName: 'Bishop Basil',
      bossElo: 900,
      bossAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bishop%20Basil',
      pawnReward: 15,
    },
    {
      order: 3,
      bossName: 'Queen Quinoa',
      bossElo: 1100,
      bossAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Queen%20Quinoa',
      pawnReward: 20,
    },
    {
      order: 4,
      bossName: 'King Kale',
      bossElo: 1300,
      bossAvatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=King%20Kale',
      pawnReward: 30,
    },
  ]

  for (const n of nodes) {
    await prisma.campaignNode.upsert({
      where: { order: n.order },
      update: {
        bossName: n.bossName,
        bossElo: n.bossElo,
        bossAvatarUrl: n.bossAvatarUrl,
        pawnReward: n.pawnReward,
      },
      create: n,
    })
  }
}

async function seedQuestsAndAchievements() {
  // No unique constraints on these models; keep it simple and deterministic by resetting.
  await prisma.userQuestProgress.deleteMany({})
  await prisma.quest.deleteMany({})
  await prisma.userAchievement.deleteMany({})
  await prisma.achievement.deleteMany({})

  await prisma.quest.createMany({
    data: [
      { title: 'Play a game', requirementCount: 1, pawnReward: 5 },
      { title: 'Win a game', requirementCount: 1, pawnReward: 10 },
      { title: 'Solve 3 puzzles', requirementCount: 3, pawnReward: 15 },
      { title: 'Learn 5 opening moves', requirementCount: 5, pawnReward: 15 },
    ],
  })

  await prisma.achievement.createMany({
    data: [
      {
        name: 'First Steps',
        iconName: 'FaShoePrints',
        description: 'Play your first game.',
      },
      {
        name: 'Tactician',
        iconName: 'FaChessKnight',
        description: 'Solve your first tactic.',
      },
      {
        name: 'Bookworm',
        iconName: 'FaBookOpen',
        description: 'Learn your first opening move.',
      },
    ],
  })
}

async function seedDemoUsersEtc() {
  // Keep demo users stable so other seeded rows can reliably connect.
  const users = await Promise.all([
    prisma.user.upsert({
      where: { clerk_id: 'seed_clerk_alice' },
      update: {},
      create: {
        clerk_id: 'seed_clerk_alice',
        name: 'Alice',
        email: 'alice@example.com',
        pawns: 200,
        xp: 250,
        rating: 1250,
      },
    }),
    prisma.user.upsert({
      where: { clerk_id: 'seed_clerk_bob' },
      update: {},
      create: {
        clerk_id: 'seed_clerk_bob',
        name: 'Bob',
        email: 'bob@example.com',
        pawns: 150,
        xp: 120,
        rating: 1150,
      },
    }),
    prisma.user.upsert({
      where: { clerk_id: 'seed_clerk_carol' },
      update: {},
      create: {
        clerk_id: 'seed_clerk_carol',
        name: 'Carol',
        email: 'carol@example.com',
        pawns: 80,
        xp: 60,
        rating: 1000,
      },
    }),
  ])

  // Friend graph (implicit many-to-many).
  await prisma.user.update({
    where: { id: users[0].id },
    data: {
      friends: {
        connect: [{ id: users[1].id }, { id: users[2].id }],
      },
    },
  })

  // Cosmetics: seed-shop populates these. Give each user the free defaults if present.
  const defaultBoard = await prisma.cosmetic.findFirst({
    where: { type: 'BOARD', price: 0 },
    orderBy: { createdAt: 'asc' },
  })
  const defaultPieces = await prisma.cosmetic.findFirst({
    where: { type: 'PIECES', price: 0 },
    orderBy: { createdAt: 'asc' },
  })

  for (const u of users) {
    if (defaultBoard) {
      await prisma.userCosmetic.upsert({
        where: { userId_cosmeticId: { userId: u.id, cosmeticId: defaultBoard.id } },
        update: { isEquipped: true },
        create: { userId: u.id, cosmeticId: defaultBoard.id, isEquipped: true },
      })
    }
    if (defaultPieces) {
      await prisma.userCosmetic.upsert({
        where: { userId_cosmeticId: { userId: u.id, cosmeticId: defaultPieces.id } },
        update: { isEquipped: true },
        create: { userId: u.id, cosmeticId: defaultPieces.id, isEquipped: true },
      })
    }
  }

  // A few games & messages.
  await prisma.game.createMany({
    data: [
      {
        whitePlayerId: users[0].id,
        blackPlayerId: users[1].id,
        result: 'WHITE_WIN',
        isOnline: true,
        moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O',
      },
      {
        whitePlayerId: users[1].id,
        blackPlayerId: users[2].id,
        result: 'DRAW',
        isOnline: false,
        moves: 'd4 d5 c4 e6 Nc3 Nf6',
      },
    ],
    skipDuplicates: true,
  })

  await prisma.message.createMany({
    data: [
      {
        senderId: users[0].id,
        receiverId: users[1].id,
        content: 'gg! Want a rematch?',
      },
      {
        senderId: users[1].id,
        receiverId: users[0].id,
        content: 'Absolutely. Same time tomorrow.',
      },
    ],
  })

  // Campaign progress: mark first node as 3 stars for Alice.
  const firstCampaignNode = await prisma.campaignNode.findUnique({ where: { order: 1 } })
  if (firstCampaignNode) {
    await prisma.userCampaignProgress.upsert({
      where: { userId_nodeId: { userId: users[0].id, nodeId: firstCampaignNode.id } },
      update: { starsEarned: 3, completedAt: new Date() },
      create: {
        userId: users[0].id,
        nodeId: firstCampaignNode.id,
        starsEarned: 3,
        completedAt: new Date(),
      },
    })
  }

  // Tour progress: seed-tournament creates regions. Set Alice to the first region.
  const firstRegion = await prisma.region.findFirst({ orderBy: { order: 'asc' } })
  if (firstRegion) {
    await prisma.userTourProgress.upsert({
      where: { userId: users[0].id },
      update: { currentRegionId: firstRegion.id, highestRoundCleared: 'Quarter-Final' },
      create: {
        userId: users[0].id,
        currentRegionId: firstRegion.id,
        highestRoundCleared: 'Quarter-Final',
      },
    })
  }

  // Opening progress: mark a handful of nodes learned for Alice if the tree exists.
  const sampleNodes = await prisma.moveNode.findMany({
    take: 8,
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (sampleNodes.length) {
    for (const n of sampleNodes) {
      await prisma.userProgress.upsert({
        where: { userId_moveNodeId: { userId: users[0].id, moveNodeId: n.id } },
        update: { isLearned: true },
        create: { userId: users[0].id, moveNodeId: n.id, isLearned: true },
      })
    }
  }

  // Quests: assign all quests to all users.
  const quests = await prisma.quest.findMany({ select: { id: true, requirementCount: true } })
  for (const u of users) {
    for (const q of quests) {
      await prisma.userQuestProgress.create({
        data: {
          userId: u.id,
          questId: q.id,
          progress: u.id === users[0].id ? Math.min(q.requirementCount, 1) : 0,
          completed: false,
        },
      })
    }
  }

  // Achievements: give Alice the first one.
  const achievements = await prisma.achievement.findMany({ orderBy: { createdAt: 'asc' }, take: 1 })
  if (achievements[0]) {
    await prisma.userAchievement.upsert({
      where: {
        userId_achievementId: { userId: users[0].id, achievementId: achievements[0].id },
      },
      update: {},
      create: { userId: users[0].id, achievementId: achievements[0].id },
    })
  }
}

async function main() {
  // This seed is intentionally *app-only* and fast.
  // Other seeds (shop, tournament, openings, puzzles, tree builder) are exposed
  // as separate package.json scripts so you can run exactly what you want.
  await seedCampaign()
  await seedQuestsAndAchievements()
  await seedDemoUsersEtc()
}

main()
  .then(() => {
    console.log('\n✅ Seed completed.')
  })
  .catch((e) => {
    console.error('\n❌ Seed failed:', e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

