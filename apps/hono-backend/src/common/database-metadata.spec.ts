import { AppDataSource } from "@repo/database";

describe("database entity metadata", () => {
  it("uses PostgreSQL-supported column types for every entity", async () => {
    await (
      AppDataSource as unknown as {
        buildMetadatas(): Promise<void>;
      }
    ).buildMetadatas();

    expect(AppDataSource.entityMetadatas.length).toBeGreaterThan(0);
  });
});
