import React, { useState } from 'react';
import { Edit, Save, Download, X, FileText } from 'lucide-react';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, WidthType, HeadingLevel, ImageRun, Header, BorderStyle } from 'docx';
import { saveAs } from 'file-saver';
import '../pages-css/Solarproposaleditor.css';

const PremiumSolarProposal = () => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  const [proposalData, setProposalData] = useState({
    systemCapacity: '125kWp/100kW',
    clientName: 'Vikarabad Govt ITI ATC',
    date: '27.11.2025',
    validity: '15 days from the date of proposal',
    contact: 'KVS Giri',
    phone: '+91 99891 01112',
    scopeOfWork: {
      description: 'Design, Supply, Installation, Testing and Commissioning of 125 kWp/ 100KWac Grid Connected Rooftop Solar PV plant',
      price: '41,25,000',
      amcDescription: 'AMC shall be provided for a period of 10 years, with charges at 1% of the project cost for the first year and an annual incremental increase of 0.5% for the subsequent 9 years. (** T&C apply)',
      gstNote: 'Prices are exclusive of GST. GST shall be charged extra as applicable at the time of billing.'
    }
  });

  const [formData, setFormData] = useState({ ...proposalData });

  // Image paths - map to public folder
  const images = {
    logo: '/images/image_1.jpeg',
    installation1: '/images/image_2.jpeg',
    aboutSystem: '/images/image_3.jpeg',
    installation2: '/images/image_5.jpeg',
    installation3: '/images/image_8.jpeg',
    netMetering: '/images/image_9.png',
    installation4: '/images/image_12.jpeg',
  };

  const handleEdit = () => {
    setFormData({ ...proposalData });
    setShowEditForm(true);
    setIsEditMode(true);
  };

  const handleSave = () => {
    setProposalData({ ...formData });
    setShowEditForm(false);
    setIsEditMode(false);
    alert('Changes saved successfully!');
  };

  const handleCancel = () => {
    setFormData({ ...proposalData });
    setShowEditForm(false);
    setIsEditMode(false);
  };

  const handleInputChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleScopeChange = (field, value) => {
    setFormData({
      ...formData,
      scopeOfWork: { ...formData.scopeOfWork, [field]: value }
    });
  };

  // Convert base64 to Uint8Array (browser-compatible)
  const base64ToUint8Array = (base64) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  // Fetch image as Uint8Array (browser-compatible)
  const fetchImageAsUint8Array = async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch image: ${url}`);
        return null;
      }
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result.split(',')[1];
          const uint8Array = base64ToUint8Array(base64);
          resolve(uint8Array);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error(`Error fetching image ${url}:`, error);
      return null;
    }
  };

  // PREMIUM DOCX EXPORT WITH IMAGES (Browser-Compatible)
  const handleExportDOCX = async () => {
    setIsExporting(true);
    
    try {
      console.log('🚀 Starting premium export with images...');

      // Fetch all images as Uint8Array
      console.log('📸 Fetching images...');
      const [logoData, inst1Data, systemData, inst2Data, inst3Data, netMeterData, inst4Data] = await Promise.all([
        fetchImageAsUint8Array(images.logo),
        fetchImageAsUint8Array(images.installation1),
        fetchImageAsUint8Array(images.aboutSystem),
        fetchImageAsUint8Array(images.installation2),
        fetchImageAsUint8Array(images.installation3),
        fetchImageAsUint8Array(images.netMetering),
        fetchImageAsUint8Array(images.installation4),
      ]);

      console.log('✅ Images fetched successfully');

      // Create document header with logo and company name
      const createHeader = () => {
        const headerChildren = [];
        
        // Add logo if available
        if (logoData) {
          headerChildren.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: logoData,
                  transformation: {
                    width: 120,
                    height: 48,
                  },
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 100 },
            })
          );
        }

        // Add company name
        headerChildren.push(
          new Paragraph({
            text: 'SESOLA POWER PROJECTS PRIVATE LIMITED',
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            border: {
              bottom: {
                color: '2563eb',
                space: 1,
                style: BorderStyle.SINGLE,
                size: 12,
              },
            },
          })
        );

        return new Header({
          children: headerChildren,
        });
      };

      // Create document with sections
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
              borders: {
                pageBorderTop: {
                  style: BorderStyle.SINGLE,
                  size: 12,
                  color: '2563eb',
                },
                pageBorderBottom: {
                  style: BorderStyle.SINGLE,
                  size: 12,
                  color: '2563eb',
                },
                pageBorderLeft: {
                  style: BorderStyle.SINGLE,
                  size: 12,
                  color: '2563eb',
                },
                pageBorderRight: {
                  style: BorderStyle.SINGLE,
                  size: 12,
                  color: '2563eb',
                },
              },
            },
          },
          headers: {
            default: createHeader(),
          },
          children: [
            // ========== TITLE ==========
            new Paragraph({
              text: 'Solar PV System Proposal',
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            // ========== SYSTEM CAPACITY ==========
            new Paragraph({
              children: [
                new TextRun({
                  text: `${proposalData.systemCapacity} Rooftop Grid Connected Solar PV Plant`,
                  color: '2563eb',
                  bold: true,
                  size: 22,
                })
              ],
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),

            // ========== CLIENT INFORMATION ==========
            new Paragraph({
              children: [
                new TextRun({ text: 'Client: ', bold: true }),
                new TextRun(proposalData.clientName)
              ],
              spacing: { after: 100 }
            }),

            new Paragraph({
              children: [
                new TextRun({ text: 'Date: ', bold: true }),
                new TextRun(proposalData.date)
              ],
              spacing: { after: 100 }
            }),

            new Paragraph({
              children: [
                new TextRun({ text: 'Validity: ', bold: true }),
                new TextRun(proposalData.validity)
              ],
              spacing: { after: 100 }
            }),

            new Paragraph({
              children: [
                new TextRun({ text: 'Contact: ', bold: true }),
                new TextRun(proposalData.contact)
              ],
              spacing: { after: 100 }
            }),

            new Paragraph({
              children: [
                new TextRun({ text: 'Phone: ', bold: true }),
                new TextRun(proposalData.phone)
              ],
              spacing: { after: 400 }
            }),

            // ========== ABOUT US ==========
            new Paragraph({
              text: 'About Us',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 200, after: 200 }
            }),

            new Paragraph({
              text: 'We choose the best-in-class components with proven performance and established credentials. Our experienced installation team provides the best workmanship. After installation, we conduct rigorous quality checks to meet our world – class standards. This process has made us one of the most trusted solar integrators in the country.',
              alignment: AlignmentType.JUSTIFIED,
              spacing: { after: 200 }
            }),

            new Paragraph({
              text: '*Installations are executed by our in – house team members.',
              italics: true,
              spacing: { after: 300 }
            }),

            // ========== INSTALLATION IMAGES ==========
            ...(inst1Data ? [
              new Paragraph({
                children: [
                  new ImageRun({
                    data: inst1Data,
                    transformation: { width: 250, height: 188 },
                  }),
                  new TextRun('  '), // spacer
                  ...(inst2Data ? [
                    new ImageRun({
                      data: inst2Data,
                      transformation: { width: 250, height: 188 },
                    })
                  ] : []),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
              }),
              new Paragraph({
                children: [
                  ...(inst3Data ? [
                    new ImageRun({
                      data: inst3Data,
                      transformation: { width: 250, height: 188 },
                    }),
                    new TextRun('  '), // spacer
                  ] : []),
                  ...(inst4Data ? [
                    new ImageRun({
                      data: inst4Data,
                      transformation: { width: 250, height: 188 },
                    })
                  ] : []),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
              }),
            ] : []),

            // ========== ABOUT THE SYSTEM ==========
            new Paragraph({
              text: 'About the System',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 }
            }),

            ...(systemData ? [
              new Paragraph({
                children: [
                  new ImageRun({
                    data: systemData,
                    transformation: { width: 500, height: 493 },
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
              })
            ] : []),

            // ========== HOW NET METERING WORKS ==========
            new Paragraph({
              text: 'How Net Metering Works',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 200, after: 200 }
            }),

            ...(netMeterData ? [
              new Paragraph({
                children: [
                  new ImageRun({
                    data: netMeterData,
                    transformation: { width: 550, height: 275 },
                  }),
                ],
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
              })
            ] : []),

            // ========== SYSTEM PRICING ==========
            new Paragraph({
              text: 'System Pricing',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 }
            }),

            // PRICING TABLE
            new Table({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: 'Scope of Work', bold: true })],
                      shading: { fill: '2563eb' },
                      width: { size: 70, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: 'Price (INR)', bold: true })],
                      shading: { fill: '2563eb' },
                      width: { size: 30, type: WidthType.PERCENTAGE },
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph(proposalData.scopeOfWork.description)],
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: `Rs. ${proposalData.scopeOfWork.price}`, bold: true })],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: proposalData.scopeOfWork.amcDescription, italics: true })],
                      columnSpan: 2,
                      shading: { fill: 'eff6ff' },
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: proposalData.scopeOfWork.gstNote, bold: true })],
                      columnSpan: 2,
                      shading: { fill: 'fef3c7' },
                    }),
                  ],
                }),
              ],
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              },
            }),

            // ========== PAYMENT TERMS ==========
            new Paragraph({
              text: 'Payment Terms:',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 400, after: 200 }
            }),

            new Paragraph({
              text: '20% of order value as advance along with Work Order.',
              bullet: { level: 0 },
              spacing: { after: 100 }
            }),

            new Paragraph({
              text: '70% of order value upon Material Performa Invoice. Upon receipt of this payment, the material will be delivered to the site within one week.',
              bullet: { level: 0 },
              spacing: { after: 100 }
            }),

            new Paragraph({
              text: '10% of order value upon commissioning of the plant.',
              bullet: { level: 0 },
              spacing: { after: 300 }
            }),

            // ========== COST INCLUSIONS ==========
            new Paragraph({
              text: 'Cost Inclusions:',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 }
            }),

            new Paragraph({
              text: 'Detailed design and engineering of the complete system.',
              bullet: { level: 0 },
              spacing: { after: 100 }
            }),

            new Paragraph({
              text: 'Delivery of the complete system as per the BoM listed.',
              bullet: { level: 0 },
              spacing: { after: 100 }
            }),

            new Paragraph({
              text: 'Supply, transportation and installation of the system as per Govt. norms.',
              bullet: { level: 0 },
              spacing: { after: 100 }
            }),

            new Paragraph({
              text: 'CEIG/ TGSPDCL approvals in supplier scope (fee will be client scope)',
              bullet: { level: 0 },
              spacing: { after: 300 }
            }),

            // ========== COST EXCLUSIONS ==========
            new Paragraph({
              text: 'Cost Exclusions:',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 }
            }),

            new Paragraph({
              text: 'Any other equipment not included in the Bill of Materials list.',
              bullet: { level: 0 },
              spacing: { after: 100 }
            }),

            new Paragraph({
              text: 'Ladder access at the rooftop to be provided by the customer.',
              bullet: { level: 0 },
              spacing: { after: 100 }
            }),

            new Paragraph({
              text: 'Internet access for inverter remote monitoring or GPRS charges in case we need to do SIM card-based monitoring.',
              bullet: { level: 0 },
              spacing: { after: 100 }
            }),

            new Paragraph({
              text: 'Post Commissioning the Insurance for the system.',
              bullet: { level: 0 },
              spacing: { after: 100 }
            }),

            new Paragraph({
              text: 'Net Metering will be scope of Client.',
              bullet: { level: 0 },
              spacing: { after: 100 }
            }),

            new Paragraph({
              text: 'Water washing of the modules is not included; however, proper training will be provided.',
              bullet: { level: 0 },
              spacing: { after: 300 }
            }),

            // ========== DELIVERY TIMELINES ==========
            new Paragraph({
              text: 'Delivery Timelines:',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 }
            }),

            new Paragraph({
              text: 'Material delivery time is 15 days from the grant of feasibility permission from the DISCOM. Installation time at site is expected to be approximately 30 days.',
              bullet: { level: 0 },
              spacing: { after: 100 }
            }),

            new Paragraph({
              text: 'Solar plant commissioning is subject to the availability of the DISCOM engineer and CEIG department. We will endeavour to get the system operational as soon as possible after installation but there are heavy Government & Department dependencies.',
              bullet: { level: 0 },
              spacing: { after: 400 }
            }),

            // ========== WARRANTY & DEFECT LIABILITY ==========
            new Paragraph({
              text: 'Warranty & Defect Liability',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 }
            }),

            new Paragraph({
              text: '*For Solar PV modules and Solar Inverters, a back-to-back warranty will be provided by the Original Equipment Manufacturer (OEM). All OEM warranty terms and conditions shall apply as per their respective warranty certificates.',
              italics: true,
              shading: { fill: 'f8f9fa' },
              spacing: { after: 300 }
            }),

            // WARRANTY TABLE
            new Table({
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: 'Item Name', bold: true })],
                      shading: { fill: 'f8f9fa' },
                      width: { size: 30, type: WidthType.PERCENTAGE },
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: 'Warranty Clause', bold: true })],
                      shading: { fill: 'f8f9fa' },
                      width: { size: 70, type: WidthType.PERCENTAGE },
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph('Solar PV modules')],
                    }),
                    new TableCell({
                      children: [
                        new Paragraph('Manufacturing Warranty- 12 years from the date of Supply'),
                        new Paragraph('Performance Warranty- 25 years as per data sheet'),
                        new Paragraph({ text: '', spacing: { after: 100 } }),
                        new Paragraph('*All warranties shall start from the date of supply.')
                      ],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph('Solar Inverter')],
                    }),
                    new TableCell({
                      children: [new Paragraph('Standard Warranty Period for String Inverters is 10 years from Date of Supply.')],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph('Balance of System')],
                    }),
                    new TableCell({
                      children: [new Paragraph('1 year from the Date of supply')],
                    }),
                  ],
                }),
              ],
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              },
            }),

            // WARRANTY VOID CONDITIONS
            new Paragraph({
              text: 'Warranty is void under the following conditions',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 300, after: 200 }
            }),

            new Paragraph({
              text: 'If the equipment or part thereof is failed/affected due to poor grid conditions, deliberate damage to the system by community, improper operation, unauthorized attempts to repair/maintenance by a non- Company (Sesola Power Projects Private Limited) authorized / certified personnel.',
              bullet: { level: 0 },
              spacing: { after: 100 }
            }),

            new Paragraph({
              text: 'Any change in the construction of the project by client or any other party after site hand over, then Sesola Power Projects Private Limited will not be responsible for performance of the Project.',
              bullet: { level: 0 },
              spacing: { after: 100 }
            }),

            new Paragraph({
              text: 'Force Majeure, including but not limited to earthquakes, lightning, acts of vandalism, network over voltages and power surges, fire, flood and any other event beyond the control of Sesola Power Projects Private Limited. Relocation of equipment without the supervision of Sesola Power Projects Private Limited.',
              bullet: { level: 0 },
              spacing: { after: 300 }
            }),

            // DEFECT LIABILITY PERIOD
            new Paragraph({
              text: 'Defect Liability Period-DLP',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 200, after: 200 }
            }),

            new Paragraph({
              text: 'The DLP will be for 1 (one) year from date of commissioning.',
              bullet: { level: 0 },
              spacing: { after: 100 }
            }),

            new Paragraph({
              text: 'During the DLP, Sesola Power Projects Private Limited shall be liable to repair and replace, correct the defects arising from faulty design, materials, or workmanship as per the agreed scope at its own costs and risks within the defined SLA timeframe.',
              bullet: { level: 0 },
              spacing: { after: 400 }
            }),

            // ========== PROPOSED BoM ==========
            new Paragraph({
              text: 'Proposed BoM and Considered Vendors',
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 400, after: 200 }
            }),

            // BOM TABLE
            new Table({
              rows: [
                // Header Row
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ text: 'S. N.', bold: true })], shading: { fill: '2563eb' }, width: { size: 8, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ text: 'Item', bold: true })], shading: { fill: '2563eb' }, width: { size: 25, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ text: 'Description / Specification', bold: true })], shading: { fill: '2563eb' }, width: { size: 42, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ text: 'Make / Brand', bold: true })], shading: { fill: '2563eb' }, width: { size: 25, type: WidthType.PERCENTAGE } }),
                  ],
                }),
                // Row 1-14
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('1')] }),
                    new TableCell({ children: [new Paragraph('Solar PV Modules')] }),
                    new TableCell({ children: [new Paragraph('550Wp, 1500V with 1.2-meter cable length')] }),
                    new TableCell({ children: [new Paragraph('INA/ Saatvik/ Goldi/ Navgruv/ Eq')] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('2')] }),
                    new TableCell({ children: [new Paragraph('Module Mounting Structures')] }),
                    new TableCell({ children: [new Paragraph('Galvalume structure')] }),
                    new TableCell({ children: [new Paragraph('Standard / TruePower / Salzer/ Solplanet/ Eq')] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('3')] }),
                    new TableCell({ children: [new Paragraph('Inverters')] }),
                    new TableCell({ children: [new Paragraph('Grid – Tie inverters')] }),
                    new TableCell({ children: [new Paragraph('Fox/ Solis/ Sineng /Eq')] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('4')] }),
                    new TableCell({ children: [new Paragraph('DC Cables')] }),
                    new TableCell({ children: [new Paragraph('As per Standard')] }),
                    new TableCell({ children: [new Paragraph('Polycab / KEI / RR/ Eq.')] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('5')] }),
                    new TableCell({ children: [new Paragraph('AC Cables')] }),
                    new TableCell({ children: [new Paragraph('As per Standard')] }),
                    new TableCell({ children: [new Paragraph('Polycab / KEI / RR/Eq.')] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('6')] }),
                    new TableCell({ children: [new Paragraph('Cable Accessories')] }),
                    new TableCell({ children: [new Paragraph('Lugs, glands, UV ties, HDPE conduits, cable trays, ferruling')] }),
                    new TableCell({ children: [new Paragraph('Standard industrial grade')] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('7')] }),
                    new TableCell({ children: [new Paragraph('ACDB')] }),
                    new TableCell({ children: [new Paragraph('IP65 rated panel with MCBs, AC SPDs, busbars')] }),
                    new TableCell({ children: [new Paragraph('L&T / Schneider / ABB/ Eq.')] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('8')] }),
                    new TableCell({ children: [new Paragraph('DCDB')] }),
                    new TableCell({ children: [new Paragraph('With fuses, SPDs (Type 2), and isolators')] }),
                    new TableCell({ children: [new Paragraph('L&T / Phoenix / Hensel/ Eq.')] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('9')] }),
                    new TableCell({ children: [new Paragraph('Earthing Kit')] }),
                    new TableCell({ children: [new Paragraph('GI/Copper electrode earthing for modules, structure, LA, Inverter')] }),
                    new TableCell({ children: [new Paragraph('Sabo / True Power / Brilltech/ Eq.')] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('10')] }),
                    new TableCell({ children: [new Paragraph('Lightning Arrestor')] }),
                    new TableCell({ children: [new Paragraph('Coverage for entire array zone')] }),
                    new TableCell({ children: [new Paragraph('True Power / Remedies / Sabo/ Eq.')] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('11')] }),
                    new TableCell({ children: [new Paragraph('Remote Monitoring System')] }),
                    new TableCell({ children: [new Paragraph('WiFi/LAN/GSM-based inverter monitoring via Data Logger')] }),
                    new TableCell({ children: [new Paragraph('Reputed')] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('12')] }),
                    new TableCell({ children: [new Paragraph('MC-4 Connectors')] }),
                    new TableCell({ children: [new Paragraph('UV resistant, certified PV connectors for strings')] }),
                    new TableCell({ children: [new Paragraph('Reputed')] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('13')] }),
                    new TableCell({ children: [new Paragraph('Signages & Labels')] }),
                    new TableCell({ children: [new Paragraph('Safety boards, array layout, inverter ID, cable ID, danger signs')] }),
                    new TableCell({ children: [new Paragraph('As per IEC/IS norms')] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph('14')] }),
                    new TableCell({ children: [new Paragraph('As-built Drawings & Documentation')] }),
                    new TableCell({ children: [new Paragraph('SLD, layout drawings, warranty certificates, datasheets')] }),
                    new TableCell({ children: [new Paragraph('Provided by Sesola Power Projects Pvt. Ltd.')] }),
                  ],
                }),
              ],
              width: { size: 100, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
              },
            }),

            // DOCUMENT FOOTER
            new Paragraph({
              text: '*****',
              alignment: AlignmentType.CENTER,
              spacing: { before: 400 }
            }),
          ],
        }],
      });

      console.log('📦 Generating DOCX...');
      const blob = await Packer.toBlob(doc);
      const fileName = `Solar_Proposal_${proposalData.clientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.docx`;
      
      console.log('💾 Saving file...');
      saveAs(blob, fileName);
      
      console.log('✅ Export complete!');
      alert('✅ Premium document exported successfully with images, logo header, and page borders!');
    } catch (error) {
      console.error('Export error:', error);
      alert('❌ Failed to export document. Error: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="complete-solar-proposal">
      {/* Header */}
      <div className="proposal-header">
        <div>
          <h1>🌟 Premium Solar PV System Proposal</h1>
          <p>Complete Document with Images, Logo Headers & Page Borders</p>
        </div>
        <div className="header-actions">
          <button className="btn-edit" onClick={handleEdit} disabled={isExporting}>
            <Edit size={18} />
            Edit Details
          </button>
          <button 
            className="btn-export" 
            onClick={handleExportDOCX}
            disabled={isExporting}
          >
            <Download size={18} />
            {isExporting ? 'Exporting...' : 'Export Premium DOCX'}
          </button>
        </div>
      </div>

      {isExporting && (
        <div className="export-status">
          <div className="spinner"></div>
          <p>Exporting premium document with images... Please wait (5-10 seconds)</p>
        </div>
      )}

      {/* Document Container */}
      <div className="document-container">
        
        {/* PAGE 1 - Cover & Client Info */}
        <div className="document-page page-1 with-border">
          <div className="page-header">
            <img src={images.logo} alt="Company Logo" className="company-logo" onError={(e) => e.target.style.display = 'none'} />
            <div className="company-name">SESOLA POWER PROJECTS PRIVATE LIMITED</div>
            <div className="header-divider"></div>
          </div>

          <h1 className="doc-title">Solar PV System Proposal</h1>
          <h2 className="system-title">{proposalData.systemCapacity} Rooftop Grid Connected Solar PV Plant</h2>

          {/* Client Info - Editable */}
          <div className={`client-information ${isEditMode ? 'edit-mode' : ''}`}>
            <div className="info-item">
              <span className="info-label">Client:</span>
              <span className="info-value">{proposalData.clientName}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Date:</span>
              <span className="info-value">{proposalData.date}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Validity:</span>
              <span className="info-value">{proposalData.validity}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Contact:</span>
              <span className="info-value">{proposalData.contact}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Phone:</span>
              <span className="info-value">{proposalData.phone}</span>
            </div>
          </div>

          {/* About Us */}
          <div className="content-section">
            <h3 className="section-heading">About Us</h3>
            <p className="section-text">
              We choose the best-in-class components with proven performance and established credentials. 
              Our experienced installation team provides the best workmanship. After installation, we conduct 
              rigorous quality checks to meet our world – class standards. This process has made us one of the 
              most trusted solar integrators in the country.
            </p>
            <p className="footnote">*Installations are executed by our in – house team members.</p>
          </div>

          {/* Installation Images Grid */}
          <div className="images-grid">
            <div className="image-placeholder">
              <img src={images.installation1} alt="Installation 1" />
            </div>
            <div className="image-placeholder">
              <img src={images.installation2} alt="Installation 2" />
            </div>
            <div className="image-placeholder">
              <img src={images.installation3} alt="Installation 3" />
            </div>
            <div className="image-placeholder">
              <img src={images.installation4} alt="Installation 4" />
            </div>
          </div>
        </div>

        {/* PAGE 2 - About the System */}
        <div className="document-page page-2 with-border">
          <div className="page-header">
            <img src={images.logo} alt="Company Logo" className="company-logo" onError={(e) => e.target.style.display = 'none'} />
            <div className="company-name">SESOLA POWER PROJECTS PRIVATE LIMITED</div>
            <div className="header-divider"></div>
          </div>

          <h3 className="section-heading">About the System</h3>
          <div className="system-diagram">
            <img src={images.aboutSystem} alt="Solar System Diagram" className="full-width-image" />
          </div>

          <h3 className="section-heading">How Net Metering Works</h3>
          <div className="net-metering-diagram">
            <img src={images.netMetering} alt="Net Metering Diagram" className="full-width-image" />
          </div>
        </div>

        {/* PAGE 3 - System Pricing */}
        <div className="document-page page-3 with-border">
          <div className="page-header">
            <img src={images.logo} alt="Company Logo" className="company-logo" onError={(e) => e.target.style.display = 'none'} />
            <div className="company-name">SESOLA POWER PROJECTS PRIVATE LIMITED</div>
            <div className="header-divider"></div>
          </div>

          <h3 className="section-heading">System Pricing</h3>

          {/* Pricing Table - Editable */}
          <div className={`pricing-table-wrapper ${isEditMode ? 'edit-mode' : ''}`}>
            <table className="pricing-table">
              <thead>
                <tr>
                  <th>Scope of Work</th>
                  <th>Price (INR)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{proposalData.scopeOfWork.description}</td>
                  <td>Rs. {proposalData.scopeOfWork.price}</td>
                </tr>
                <tr>
                  <td colSpan="2" className="amc-cell">
                    {proposalData.scopeOfWork.amcDescription}
                  </td>
                </tr>
                <tr>
                  <td colSpan="2" className="gst-cell">
                    {proposalData.scopeOfWork.gstNote}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment Terms */}
          <div className="content-section">
            <h4 className="subsection-heading">Payment Terms:</h4>
            <ul className="terms-list">
              <li>20% of order value as advance along with Work Order.</li>
              <li>70% of order value upon Material Performa Invoice. Upon receipt of this payment, the material will be delivered to the site within one week.</li>
              <li>10% of order value upon commissioning of the plant.</li>
            </ul>
          </div>

          {/* Cost Inclusions */}
          <div className="content-section">
            <h4 className="subsection-heading">Cost Inclusions:</h4>
            <ul className="terms-list">
              <li>Detailed design and engineering of the complete system.</li>
              <li>Delivery of the complete system as per the BoM listed.</li>
              <li>Supply, transportation and installation of the system as per Govt. norms.</li>
              <li>CEIG/ TGSPDCL approvals in supplier scope (fee will be client scope)</li>
            </ul>
          </div>

          {/* Cost Exclusions */}
          <div className="content-section">
            <h4 className="subsection-heading">Cost Exclusions:</h4>
            <ul className="terms-list">
              <li>Any other equipment not included in the Bill of Materials list.</li>
              <li>Ladder access at the rooftop to be provided by the customer.</li>
              <li>Internet access for inverter remote monitoring or GPRS charges in case we need to do SIM card-based monitoring.</li>
              <li>Post Commissioning the Insurance for the system.</li>
              <li>Net Metering will be scope of Client.</li>
              <li>Water washing of the modules is not included; however, proper training will be provided.</li>
            </ul>
          </div>

          {/* Delivery Timelines */}
          <div className="content-section">
            <h4 className="subsection-heading">Delivery Timelines:</h4>
            <ul className="terms-list">
              <li>Material delivery time is 15 days from the grant of feasibility permission from the DISCOM. Installation time at site is expected to be approximately 30 days.</li>
              <li>Solar plant commissioning is subject to the availability of the DISCOM engineer and CEIG department. We will endeavour to get the system operational as soon as possible after installation but there are heavy Government & Department dependencies.</li>
            </ul>
          </div>
        </div>

        {/* PAGE 4 - Warranty */}
        <div className="document-page page-4 with-border">
          <div className="page-header">
            <img src={images.logo} alt="Company Logo" className="company-logo" onError={(e) => e.target.style.display = 'none'} />
            <div className="company-name">SESOLA POWER PROJECTS PRIVATE LIMITED</div>
            <div className="header-divider"></div>
          </div>

          <h3 className="section-heading">Warranty & Defect Liability</h3>
          
          <p className="warranty-note">
            *For Solar PV modules and Solar Inverters, a back-to-back warranty will be provided by the Original Equipment Manufacturer (OEM). All OEM warranty terms and conditions shall apply as per their respective warranty certificates.
          </p>

          {/* Warranty Table */}
          <table className="warranty-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Warranty Clause</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Solar PV modules</td>
                <td>Manufacturing Warranty- 12 years from the date of Supply<br/>Performance Warranty- 25 years as per data sheet<br/><br/>*All warranties shall start from the date of supply.</td>
              </tr>
              <tr>
                <td>Solar Inverter</td>
                <td>Standard Warranty Period for String Inverters is 10 years from Date of Supply.</td>
              </tr>
              <tr>
                <td>Balance of System</td>
                <td>1 year from the Date of supply</td>
              </tr>
            </tbody>
          </table>

          <h4 className="subsection-heading" style={{marginTop: '32px'}}>Warranty is void under the following conditions</h4>
          <ul className="terms-list small">
            <li>If the equipment or part thereof is failed/affected due to poor grid conditions, deliberate damage to the system by community, improper operation, unauthorized attempts to repair/maintenance by a non- Company (Sesola Power Projects Private Limited) authorized / certified personnel.</li>
            <li>Any change in the construction of the project by client or any other party after site hand over, then Sesola Power Projects Private Limited will not be responsible for performance of the Project.</li>
            <li>Force Majeure, including but not limited to earthquakes, lightning, acts of vandalism, network over voltages and power surges, fire, flood and any other event beyond the control of Sesola Power Projects Private Limited.</li>
          </ul>

          <h4 className="subsection-heading">Defect Liability Period-DLP</h4>
          <ul className="terms-list small">
            <li>The DLP will be for 1 (one) year from date of commissioning.</li>
            <li>During the DLP, Sesola Power Projects Private Limited shall be liable to repair and replace, correct the defects arising from faulty design, materials, or workmanship as per the agreed scope at its own costs and risks within the defined SLA timeframe.</li>
          </ul>
        </div>

        {/* PAGE 5 - Bill of Materials */}
        <div className="document-page page-5 with-border">
          <div className="page-header">
            <img src={images.logo} alt="Company Logo" className="company-logo" onError={(e) => e.target.style.display = 'none'} />
            <div className="company-name">SESOLA POWER PROJECTS PRIVATE LIMITED</div>
            <div className="header-divider"></div>
          </div>

          <h3 className="section-heading">Proposed BoM and Considered Vendors</h3>

          <table className="bom-table">
            <thead>
              <tr>
                <th>S. N.</th>
                <th>Item</th>
                <th>Description / Specification</th>
                <th>Make / Brand</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>Solar PV Modules</td><td>550Wp, 1500V with 1.2-meter cable length</td><td>INA/ Saatvik/ Goldi/ Navgruv/ Eq</td></tr>
              <tr><td>2</td><td>Module Mounting Structures</td><td>Galvalume structure</td><td>Standard / TruePower / Salzer/ Solplanet/ Eq</td></tr>
              <tr><td>3</td><td>Inverters</td><td>Grid – Tie inverters</td><td>Fox/ Solis/ Sineng /Eq</td></tr>
              <tr><td>4</td><td>DC Cables</td><td>As per Standard</td><td>Polycab / KEI / RR/ Eq.</td></tr>
              <tr><td>5</td><td>AC Cables</td><td>As per Standard</td><td>Polycab / KEI / RR/Eq.</td></tr>
              <tr><td>6</td><td>Cable Accessories</td><td>Lugs, glands, UV ties, HDPE conduits, cable trays, ferruling</td><td>Standard industrial grade</td></tr>
              <tr><td>7</td><td>ACDB</td><td>IP65 rated panel with MCBs, AC SPDs, busbars</td><td>L&T / Schneider / ABB/ Eq.</td></tr>
              <tr><td>8</td><td>DCDB</td><td>With fuses, SPDs (Type 2), and isolators</td><td>L&T / Phoenix / Hensel/ Eq.</td></tr>
              <tr><td>9</td><td>Earthing Kit</td><td>GI/Copper electrode earthing for modules, structure, LA, Inverter</td><td>Sabo / True Power / Brilltech/ Eq.</td></tr>
              <tr><td>10</td><td>Lightning Arrestor</td><td>Coverage for entire array zone</td><td>True Power / Remedies / Sabo/ Eq.</td></tr>
              <tr><td>11</td><td>Remote Monitoring System</td><td>WiFi/LAN/GSM-based inverter monitoring via Data Logger</td><td>Reputed</td></tr>
              <tr><td>12</td><td>MC-4 Connectors</td><td>UV resistant, certified PV connectors for strings</td><td>Reputed</td></tr>
              <tr><td>13</td><td>Signages & Labels</td><td>Safety boards, array layout, inverter ID, cable ID, danger signs</td><td>As per IEC/IS norms</td></tr>
              <tr><td>14</td><td>As-built Drawings & Documentation</td><td>SLD, layout drawings, warranty certificates, datasheets</td><td>Provided by Sesola Power Projects Pvt. Ltd.</td></tr>
            </tbody>
          </table>

          <div className="document-footer">
            <p>*****</p>
          </div>
        </div>

      </div>

      {/* Edit Form Modal */}
      {showEditForm && (
        <div className="modal-overlay">
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Proposal Details</h2>
              <button className="btn-close" onClick={handleCancel}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* Client Information */}
              <div className="form-section">
                <h3>Client Information</h3>

                <div className="form-group">
                  <label>Client Name *</label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => handleInputChange('clientName', e.target.value)}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Date *</label>
                    <input
                      type="text"
                      value={formData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Validity *</label>
                    <input
                      type="text"
                      value={formData.validity}
                      onChange={(e) => handleInputChange('validity', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Contact Person *</label>
                    <input
                      type="text"
                      value={formData.contact}
                      onChange={(e) => handleInputChange('contact', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone Number *</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* System Pricing */}
              <div className="form-section">
                <h3>System Pricing</h3>

                <div className="form-group">
                  <label>Scope of Work Description *</label>
                  <textarea
                    rows="3"
                    value={formData.scopeOfWork.description}
                    onChange={(e) => handleScopeChange('description', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Price (INR) *</label>
                  <input
                    type="text"
                    value={formData.scopeOfWork.price}
                    onChange={(e) => handleScopeChange('price', e.target.value)}
                  />
                  <small>Enter amount without 'Rs.' prefix</small>
                </div>

                <div className="form-group">
                  <label>AMC Description</label>
                  <textarea
                    rows="3"
                    value={formData.scopeOfWork.amcDescription}
                    onChange={(e) => handleScopeChange('amcDescription', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>GST Note</label>
                  <textarea
                    rows="2"
                    value={formData.scopeOfWork.gstNote}
                    onChange={(e) => handleScopeChange('gstNote', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-save" onClick={handleSave}>
                <Save size={18} />
                Save Changes
              </button>
              <button className="btn-cancel" onClick={handleCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PremiumSolarProposal;