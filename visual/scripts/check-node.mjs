const [major] = process.versions.node.split(".").map(Number);

if (major !== 20) {
    console.error(
        `This project is standardized on Node 20.x for Power BI tooling compatibility. Current version: ${process.versions.node}`
    );
    process.exit(1);
}
