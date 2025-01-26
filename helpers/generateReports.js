// eslint-disable-next-line no-undef
const ExcelJS = require('exceljs');
// eslint-disable-next-line no-undef
const PdfPrinter = require('pdfmake');
// eslint-disable-next-line no-undef
const Order = require('../models/orderSchema'); // Assuming you have the Order model

// Define fonts for pdfmake
const fonts = {
    Roboto: {
        normal: 'public/fonts/Roboto-Regular.ttf',
        bold: 'public/fonts/Roboto-Medium.ttf',
        italics: 'public/fonts/Roboto-Italic.ttf',
        bolditalics: 'public/fonts/Roboto-MediumItalic.ttf'
    }
};

const printer = new PdfPrinter(fonts);

async function generatePDFReport(filterType, specificDate, startDate, endDate, includeDiscounts) {
    // Fetch sales data based on filter criteria
    let matchCriteria = {};
    if (filterType === 'custom') {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);  // Set the end date to 23:59:59.999
        
        matchCriteria.createdOn = { $gte: start, $lte: end };
    } else if (filterType === 'daily') {
        if (!specificDate) {
            throw new Error('Specific date is required for daily report');
        }
        
        const specificDateObj = new Date(specificDate);
        const startOfDay = new Date(specificDateObj.getFullYear(), specificDateObj.getMonth(), specificDateObj.getDate());
        const endOfDay = new Date(specificDateObj.getFullYear(), specificDateObj.getMonth(), specificDateObj.getDate() + 1);
    
        matchCriteria.createdOn = {
            $gte: startOfDay,
            $lt: endOfDay
        };
    } else if (filterType === 'weekly') {
        matchCriteria.createdOn = { $gte: new Date(new Date().setDate(new Date().getDate() - 7)), $lte: new Date() };
    } else if (filterType === 'monthly') {
        matchCriteria.createdOn = { $gte: new Date(new Date().setDate(new Date().getDate() - 30)), $lte: new Date() };
    }

    const salesData = await Order.find(matchCriteria);

    if (filterType === 'custom' && salesData.length === 0) {
        // eslint-disable-next-line no-undef
        return Buffer.from('No orders found for the selected date range.');
    }

    // Calculate overall sales count, order amount, and discount
    const overallSalesCount = salesData.length;
    const overallOrderAmount = salesData.reduce((acc, order) => acc + order.finalAmount, 0);
    const overallDiscount = salesData.reduce((acc, order) => acc + order.discount, 0);

    // Prepare the document definition
    const docDefinition = {
        content: [
            {
                image: 'public/img/logo.png',
                width: 100
            },
            {
                text: 'Sales Report',
                style: 'header'
            },
            {
                text: `Overall Sales Count: ${overallSalesCount}`,
                style: 'subheader'
            },
            {
                text: `Overall Order Amount: ${overallOrderAmount.toFixed(2)}`,
                style: 'subheader'
            },
            {
                text: `Overall Discount: ${overallDiscount.toFixed(2)}`,
                style: 'subheader'
            },
            {
                text: `Filter: ${filterType.charAt(0).toUpperCase() + filterType.slice(1)} ${filterType === 'custom' ? `(from ${startDate} to ${endDate})` : ''}`,
                style: 'subheader'
            },
            {
                table: {
                    headerRows: 1,
                    widths: ['*', 'auto', 'auto', 'auto'],
                    body: [
                        [{ text: 'Order ID', style: 'tableHeader' }, { text: 'Total Amount', style: 'tableHeader' }, { text: 'Discount', style: 'tableHeader' }, { text: 'Date', style: 'tableHeader' }],
                        ...salesData.map((order, index) => [
                            {
                                text: order.orderId,
                                fillColor: index % 2 === 0 ? '#d8eafc' : null,
                                margin: [5, 5, 5, 5]
                            },
                            {
                                text: order.finalAmount.toFixed(2),
                                fillColor: index % 2 === 0 ? '#d8eafc' : null,
                                alignment: 'right',
                                margin: [5, 5, 5, 5]
                            },
                            {
                                text: includeDiscounts ? order.discount.toFixed(2) : 'N/A',
                                fillColor: index % 2 === 0 ? '#d8eafc' : null,
                                alignment: 'right',
                                margin: [5, 5, 5, 5]
                            },
                            {
                                text: order.createdOn.toLocaleDateString(),
                                fillColor: index % 2 === 0 ? '#d8eafc' : null,
                                alignment: 'center',
                                margin: [5, 5, 5, 5]
                            }
                        ])
                    ],
                    layout: {
                        // Custom layout with no borders
                        
                        // eslint-disable-next-line no-unused-vars
                        hLineWidth: function (i, node) {
                            return 0; // no horizontal line
                        },
                        // eslint-disable-next-line no-unused-vars
                        vLineWidth: function (i, node) {
                            return 0; // no vertical line
                        },
                        // eslint-disable-next-line no-unused-vars
                        hLineColor: function (i, node) {
                            return '#fff'; // no horizontal line color
                        },
                        // eslint-disable-next-line no-unused-vars
                        vLineColor: function (i, node) {
                            return '#fff'; // no vertical line color
                        },
                        // eslint-disable-next-line no-unused-vars
                        paddingLeft: function (i) {
                            return 5; // padding inside cells
                        },
                        // eslint-disable-next-line no-unused-vars
                        paddingRight: function (i) {
                            return 5; // padding inside cells
                        },
                        // eslint-disable-next-line no-unused-vars
                        paddingTop: function (i) {
                            return 5; // padding inside cells
                        },
                        // eslint-disable-next-line no-unused-vars
                        paddingBottom: function (i) {
                            return 5; // padding inside cells
                        }
                    }
                }
            },
            {
                text: `Report generated on: ${new Date().toLocaleString()}`,
                style: 'footer',
                alignment: 'right',
                margin: [0, 20, 0, 0] // Add some margin for spacing
            }
        ],
        styles: {
            header: {
                fontSize: 28,
                bold: true,
                alignment: 'center'
            },
            subheader: {
                fontSize: 12,
                bold: true,
                margin: [0, 10, 0, 5]
            },
            tableHeader: {
                bold: true,
                fontSize: 10,
                color: 'black'
            },
            footer: {
                fontSize: 10,
                italics: true,
                color: 'gray'
            }
        }
    };

    // Create the PDF and return the buffer
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    let buffers = [];
    pdfDoc.on('data', buffers.push.bind(buffers));
    pdfDoc.on('end', () => {
        // eslint-disable-next-line no-undef
        const pdfData = Buffer.concat(buffers);
        return pdfData;
    });
    pdfDoc.end();

    return new Promise((resolve) => {
        pdfDoc.on('end', () => {
            // eslint-disable-next-line no-undef
            const pdfData = Buffer.concat(buffers);
            resolve(pdfData);
        });
    });
}

async function generateExcelReport(filterType, specificDate, startDate, endDate, includeDiscounts) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    let matchCriteria = {};
    if (filterType === 'custom') {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);  // Set the end date to 23:59:59.999
        
        matchCriteria.createdOn = { $gte: start, $lte: end };
    } else if (filterType === 'daily') {
        if (!specificDate) {
            throw new Error('Specific date is required for daily report');
        }
        
        const specificDateObj = new Date(specificDate);
        const startOfDay = new Date(specificDateObj.getFullYear(), specificDateObj.getMonth(), specificDateObj.getDate());
        const endOfDay = new Date(specificDateObj.getFullYear(), specificDateObj.getMonth(), specificDateObj.getDate() + 1);
    
        matchCriteria.createdOn = {
            $gte: startOfDay,
            $lt: endOfDay
        };
    } else if (filterType === 'weekly') {
        matchCriteria.createdOn = { $gte: new Date(new Date().setDate(new Date().getDate() - 7)), $lte: new Date() };
    } else if (filterType === 'monthly') {
        matchCriteria.createdOn = { $gte: new Date(new Date().setDate(new Date().getDate() - 30)), $lte: new Date() };
    }
    const salesData = await Order.find(matchCriteria);

    if (filterType === 'custom' && salesData.length === 0) {
        worksheet.addRow(['No orders found for the selected date range.']);
        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
    }

    // Add column headers
    worksheet.columns = [
        { header: 'Order ID', key: 'orderId', width: 30 },
        { header: 'Total Amount', key: 'totalAmount', width: 15 },
        { header: 'Discount', key: 'discount', width: 15 },
        { header: 'Date', key: 'date', width: 20 },
    ];

    // Add sales data to the worksheet
    salesData.forEach(order => {
        worksheet.addRow({
            orderId: order.orderId,
            totalAmount: order.finalAmount,
            discount: includeDiscounts ? order.discount : 'N/A',
            date: order.createdOn.toLocaleDateString(),
        });
    });

    // Generate buffer for the Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}

// eslint-disable-next-line no-undef
module.exports = {
    generatePDFReport,
    generateExcelReport,
};