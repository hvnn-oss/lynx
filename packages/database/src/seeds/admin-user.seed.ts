import { ADMIN_ROLES, type AdminRole } from "@repo/constants";
import { AdminUserEntity } from "../entities/admin/admin-user.entity";
import { UserEntity } from "../entities/organization/user.entity";
import { AppDataSource } from "../data-source";

const ADMIN_ROLE_VALUES = new Set<string>(Object.values(ADMIN_ROLES));

async function seedAdminUser() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const role = process.env.ADMIN_ROLE?.trim() || ADMIN_ROLES.SUPER_ADMIN;

  if (!email) {
    throw new Error("ADMIN_EMAIL is required.");
  }

  if (!ADMIN_ROLE_VALUES.has(role)) {
    throw new Error(
      `ADMIN_ROLE must be one of: ${[...ADMIN_ROLE_VALUES].join(", ")}.`,
    );
  }

  await AppDataSource.initialize();

  try {
    const userRepository = AppDataSource.getRepository(UserEntity);
    const adminRepository = AppDataSource.getRepository(AdminUserEntity);
    const user = await userRepository.findOne({ where: { email } });

    if (!user) {
      throw new Error(`User not found: ${email}`);
    }

    const existing = await adminRepository.findOne({
      where: { user: { id: user.id } },
      relations: { user: true },
    });

    if (existing) {
      existing.role = role as AdminRole;
      existing.isActive = true;
      await adminRepository.save(existing);
    } else {
      await adminRepository.save(
        adminRepository.create({
          user,
          role: role as AdminRole,
          isActive: true,
        }),
      );
    }

    console.log(`Granted ${role} to ${email}.`);
  } finally {
    await AppDataSource.destroy();
  }
}

seedAdminUser().catch((error: unknown) => {
  console.error("Failed to seed admin user.", error);
  process.exitCode = 1;
});
