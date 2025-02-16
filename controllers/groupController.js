const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { sendPushNotification } = require("../utils/pushNotifications");

exports.createGroup = async (req, res) => {
  try {
    const { name, description } = req.body;
    const userId = req.user.id; // Assuming you have user info in request

    const group = await prisma.group.create({
      data: {
        name,
        description,
        createdBy: userId,
        members: {
          connect: [{ id: userId }], // Add creator as first member
        },
      },
      include: {
        members: true,
        messages: {
          take: 1,
          orderBy: {
            createdAt: "desc",
          },
          include: {
            sender: true,
          },
        },
      },
    });

    // Format the response to match frontend expectations
    const formattedGroup = {
      id: group.id,
      name: group.name,
      description: group.description,
      memberCount: group.members.length,
      createdBy: group.createdBy,
      lastMessage: group.messages[0]
        ? {
            text: group.messages[0].content,
            timestamp: group.messages[0].createdAt,
          }
        : null,
    };

    res.status(201).json(formattedGroup);
  } catch (error) {
    console.error("Create group error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getAllGroups = async (req, res) => {
  try {
    console.log("getAllGroups");
    const userId = req.user.id;
    const group = await prisma.group.findMany({
      where: {
        members: {
          some: { id: userId },
        },
      },
      include: {
        members: true,
        messages: true,
      },
    });
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    res.json(group);
  } catch (error) {
    console.error("Get all groups error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getGroupById = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await prisma.group.findUnique({
      where: { id: Number(id) },
      include: {
        members: true,
        messages: true,
      },
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.json(group);
  } catch (error) {
    console.error("Get group error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getGroupMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await prisma.message.findMany({
      where: { groupId: Number(id) },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });
    res.json(messages);
  } catch (error) {
    console.error("Get group messages error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, imageUrl } = req.body;
    const userId = req.user.id;

    if (!content && !imageUrl) {
      console.error("Backend: No content or imageUrl provided");
      return res.status(400).json({
        message: "Message must have either content or image",
      });
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        content: content, // Don't use the || '' fallback
        imageUrl: imageUrl || null,
        groupId: Number(id),
        senderId: userId,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    res.json(message);
  } catch (error) {
    console.error("Backend: Send message error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.getGroupMembers = async (req, res) => {
  try {
    const { id } = req.params;
    const group = await prisma.group.findUnique({
      where: { id: Number(id) },
      include: { members: true },
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.json(group.members);
  } catch (error) {
    console.error("Get group members error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.addMemberToGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    const group = await prisma.group.update({
      where: { id: Number(id) },
      data: {
        members: {
          connect: { id: userId },
        },
      },
    });

    res.json(group);
  } catch (error) {
    console.error("Add member to group error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.removeMemberFromGroup = async (req, res) => {
  try {
    const { id, memberId } = req.params;

    const group = await prisma.group.update({
      where: { id: Number(id) },
      data: {
        members: {
          disconnect: { id: Number(memberId) },
        },
      },
    });

    res.json(group);
  } catch (error) {
    console.error("Remove member from group error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.searchUserbyPhone = async (req, res) => {
  try {
    const { phone } = req.params;
    const user = await prisma.user.findFirst({ where: { phone: phone } });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Search user by phone error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getGroupProperties = async (req, res) => {
  try {
    const { id } = req.params;
    const { memberId } = req.query;
    const loggedInUserId = req.user.id; // Get logged-in user's ID

    // If memberId is provided, only get that member's properties
    if (memberId) {
      // Don't show properties if the selected member is the logged-in user
      if (Number(memberId) === loggedInUserId) {
        return res.json({ properties: [] });
      }

      // First verify that the member belongs to this group
      const memberInGroup = await prisma.group.findFirst({
        where: {
          id: Number(id),
          members: {
            some: {
              id: Number(memberId),
            },
          },
        },
      });

      if (!memberInGroup) {
        return res.status(404).json({
          message: "Member not found in this group",
        });
      }

      // Get only this member's properties
      const properties = await prisma.property.findMany({
        where: {
          AND: [
            { postedById: Number(memberId) },
            { postedBy: { groupId: Number(id) } },
          ],
        },
        include: {
          imageUrls: true,
          amenities: true,
          postedBy: {
            select: {
              id: true,
              name: true,
              phone: true,
              groupId: true,
              Group: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      return res.json({ properties });
    }

    // Otherwise, get all group members' properties (except logged-in user's)
    const group = await prisma.group.findUnique({
      where: { id: Number(id) },
      include: { members: true },
    });

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // Filter out the logged-in user from memberIds
    const memberIds = group.members
      .filter((member) => member.id !== loggedInUserId)
      .map((member) => member.id);

    const properties = await prisma.property.findMany({
      where: {
        AND: [
          { postedById: { in: memberIds } },
          { postedBy: { groupId: Number(id) } },
          { postedById: { not: loggedInUserId } }, // Extra check to ensure logged-in user's properties are excluded
        ],
      },
      include: {
        imageUrls: true,
        amenities: true,
        postedBy: {
          select: {
            id: true,
            name: true,
            phone: true,
            groupId: true,
            Group: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    res.json({ properties });
  } catch (error) {
    console.error("Get group properties error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getGroupMember = async (req, res) => {
  try {
    const { id, memberId } = req.params;
    const member = await prisma.user.findFirst({
      where: {
        id: Number(memberId),
        groupId: Number(id),
      },
      select: {
        id: true,
        name: true,
        phone: true,
      },
    });

    if (!member) {
      return res
        .status(404)
        .json({ message: "Member not found in this group" });
    }

    res.json(member);
  } catch (error) {
    console.error("Get group member error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.sendImageMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Handle image upload (you'll need to implement your own image upload logic)
    const imageUrl = await uploadImage(req.files.image); // Implement this function

    // Create message with image
    const message = await prisma.message.create({
      data: {
        content: "",
        imageUrl,
        groupId: Number(id),
        senderId: userId,
      },
      include: {
        sender: true,
      },
    });

    res.json(message);
  } catch (error) {
    console.error("Send image message error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
