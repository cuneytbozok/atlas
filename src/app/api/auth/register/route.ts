import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password } = body;

    // Validate input
    if (!email || !password) {
      return NextResponse.json(
        { message: "Email and password are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "User with this email already exists" },
        { status: 409 }
      );
    }

    // Get the USER role
    const userRole = await prisma.role.findFirst({
      where: { name: "USER" },
    });

    if (!userRole) {
      return NextResponse.json(
        { message: "Failed to assign role to user - USER role not found" },
        { status: 500 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user with the USER role assigned
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        userRoles: {
          create: {
            roleId: userRole.id,
          }
        }
      },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    
    console.log(`Created new user ${user.id} (${user.email}) with role: ${userRole.name}`);
    
    return NextResponse.json(
      { 
        message: "User registered successfully", 
        user: userWithoutPassword 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { message: "An error occurred during registration" },
      { status: 500 }
    );
  }
} 