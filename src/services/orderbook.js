// ================================================================
// ADD THIS ENDPOINT TO YOUR BACKEND (Node.js / Express)
// File: routes/orderbook.js  (or wherever your order-book routes live)
// ================================================================

const path = require('path');
const fs   = require('fs');

// GET /order-book/download-template
router.get('/download-template', (req, res) => {
  try {
    const filePath = path.join(
      __dirname,
      '../assets/templates/OrderBook_Template_Colored.xlsx'
      //  ↑ adjust this relative path to match your project structure
    );

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Template file not found on server'
      });
    }

    const date     = new Date().toISOString().split('T')[0];
    const fileName = `OrderBook_Template_${date}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );

    fs.createReadStream(filePath).pipe(res);

  } catch (error) {
    console.error('Template download error:', error);
    res.status(500).json({ success: false, message: 'Failed to download template' });
  }
});

// ================================================================
// JAVA SPRING BOOT VERSION (if your backend is Java)
// ================================================================

/*
@GetMapping("/order-book/download-template")
public ResponseEntity<Resource> downloadTemplate() throws IOException {
    ClassPathResource file = new ClassPathResource("templates/OrderBook_Template_Colored.xlsx");
    // Place the .xlsx inside src/main/resources/templates/

    String date     = LocalDate.now().toString();
    String fileName = "OrderBook_Template_" + date + ".xlsx";

    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
        .contentType(MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
        .body(new InputStreamResource(file.getInputStream()));
}
*/