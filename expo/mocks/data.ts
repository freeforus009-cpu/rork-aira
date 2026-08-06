import { User, Subject, Section, COC, LearningOutcome, Content, Quiz, Question, GradeLevel, Semester, InviteCode } from '@/types';

export const DEFAULT_SUPER_ADMIN: User = {
  id: 'super-admin-001',
  fullName: 'Aira Admin',
  username: 'Aira Admin',
  email: 'aira@admin.edu.ph',
  password: 'Aira@admin',
  role: 'super_admin',
  themePreference: 'dark',
  createdAt: new Date().toISOString(),
  is_verified: true,
  schoolOrganization: 'AIRA Demonstration School',
  accountType: 'admin',
};

export const MOCK_ADMIN_1: User = {
  id: 'ADMIN_001',
  fullName: 'Teacher Maria Santos',
  username: 'Teacher Maria Santos',
  email: 'maria.santos@deped.gov.ph',
  password: 'Maria@123',
  role: 'admin',
  themePreference: 'dark',
  createdAt: new Date().toISOString(),
  is_verified: true,
  schoolOrganization: 'San Isidro National High School',
  accountType: 'teacher',
};

export const MOCK_ADMIN_2: User = {
  id: 'ADMIN_002',
  fullName: 'Teacher John Reyes',
  username: 'Teacher John Reyes',
  email: 'john.reyes@deped.gov.ph',
  password: 'John@123',
  role: 'admin',
  themePreference: 'dark',
  createdAt: new Date().toISOString(),
  is_verified: true,
  schoolOrganization: 'Rizal Integrated School',
  accountType: 'teacher',
};

export const MOCK_STUDENT_1: User = {
  id: 'STUDENT_001',
  fullName: 'Juan Dela Cruz',
  username: 'Juan Dela Cruz',
  email: 'juan@student.com',
  password: 'Juan@123',
  role: 'student',
  adminId: 'ADMIN_001',
  sectionId: 'section-g10-ict-a',
  gradeLevel: 'Grade 10',
  subjectIds: [],
  themePreference: 'dark',
  createdAt: new Date().toISOString(),
  is_verified: true,
};

export const MOCK_STUDENT_2: User = {
  id: 'STUDENT_002',
  fullName: 'Maria Lopez',
  username: 'Maria Lopez',
  email: 'maria@student.com',
  password: 'Maria@123',
  role: 'student',
  adminId: 'ADMIN_002',
  sectionId: 'section-g11-stem-b',
  gradeLevel: 'Grade 11',
  subjectIds: [],
  themePreference: 'dark',
  createdAt: new Date().toISOString(),
  is_verified: true,
};

export const MOCK_USERS: User[] = [
  DEFAULT_SUPER_ADMIN,
  MOCK_ADMIN_1,
  MOCK_ADMIN_2,
  MOCK_STUDENT_1,
  MOCK_STUDENT_2,
];

export const MOCK_INVITE_CODES: InviteCode[] = [
  { id: 'inv-auto-001', code: 'ACSS-7F2K9A1B', adminId: 'ADMIN_001', role: 'student', is_active: true, createdAt: new Date().toISOString(), usedCount: 0 },
  { id: 'inv-manual-001', code: 'MANUAL-ADMIN-001', adminId: 'ADMIN_001', role: 'student', is_active: true, createdAt: new Date().toISOString(), usedCount: 0 },
  { id: 'inv-auto-002', code: 'ACSS-9X8M3P2Q', adminId: 'ADMIN_002', role: 'student', is_active: true, createdAt: new Date().toISOString(), usedCount: 0 },
  { id: 'inv-manual-002', code: 'MANUAL-ADMIN-002', adminId: 'ADMIN_002', role: 'student', is_active: true, createdAt: new Date().toISOString(), usedCount: 0 },
  { id: 'inv-super-001', code: 'SUPER-ADMIN-INIT-001', adminId: 'super-admin-001', role: 'admin', is_active: true, createdAt: new Date().toISOString(), usedCount: 0 },
];

export const DEFAULT_SUBJECTS: Subject[] = [
  {
    id: 'subject-css-nc2',
    adminId: 'super-admin-001',
    name: 'CSS NC II - Computer Systems Servicing',
    description: 'Technical Education and Skills Development Authority (TESDA) qualification for Computer Systems Servicing NC II.',
    code: 'CSS-NC-II',
    createdAt: new Date().toISOString(),
    unlockType: 'sequential',
    createdBy: 'super_admin',
    subjectType: 'global',
    isGlobal: true,
    adoptedBy: [],
    sharedWithAdminIds: [],
    gradeLevel: 'Grade 12',
    semester: '1st Semester',
  },
  {
    id: 'subject-vgd-nc3',
    adminId: 'super-admin-001',
    name: 'VGD NC III - Visual Graphic Design',
    description: 'TESDA qualification for Visual Graphic Design NC III covering design principles and software.',
    code: 'VGD-NC-III',
    createdAt: new Date().toISOString(),
    unlockType: 'sequential',
    createdBy: 'super_admin',
    subjectType: 'global',
    isGlobal: true,
    adoptedBy: [],
    sharedWithAdminIds: [],
    gradeLevel: 'Grade 12',
    semester: '1st Semester',
  },
  {
    id: 'subject-emp-tech',
    adminId: 'super-admin-001',
    name: 'Empowerment Technology',
    description: 'General education subject covering ICT basics, online platforms, and digital productivity.',
    code: 'EMP-TECH',
    createdAt: new Date().toISOString(),
    unlockType: 'flexible',
    createdBy: 'super_admin',
    subjectType: 'global',
    isGlobal: true,
    adoptedBy: [],
    sharedWithAdminIds: [],
    gradeLevel: 'Grade 11',
    semester: '2nd Semester',
  },
];

export const DEFAULT_SECTIONS: Section[] = [
  { id: 'section-ict-a', adminId: 'super-admin-001', name: 'Grade 12 - ICT A', description: 'ICT Strand - Section A', createdAt: new Date().toISOString(), gradeLevel: 'Grade 12' },
  { id: 'section-ict-b', adminId: 'super-admin-001', name: 'Grade 12 - ICT B', description: 'ICT Strand - Section B', createdAt: new Date().toISOString(), gradeLevel: 'Grade 12' },
  { id: 'section-g10-ict-a', adminId: 'ADMIN_001', name: 'Grade 10 - ICT A', description: 'ICT Strand Section A - Admin 1', createdAt: new Date().toISOString(), gradeLevel: 'Grade 10' },
  { id: 'section-g11-stem-b', adminId: 'ADMIN_002', name: 'Grade 11 - STEM B', description: 'STEM Strand Section B - Admin 2', createdAt: new Date().toISOString(), gradeLevel: 'Grade 11' },
];

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export function getDefaultCOCs(): COC[] {
  return [
    // CSS NC II COCs
    { id: 'coc-css-1', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Install and Configure Computer Systems', description: 'Competency in installing and configuring computer hardware and software systems.', order: 1, createdAt: new Date().toISOString() },
    { id: 'coc-css-2', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Set-Up Computer Networks', description: 'Competency in setting up and configuring computer networks.', order: 2, createdAt: new Date().toISOString() },
    { id: 'coc-css-3', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Set-Up Computer Servers', description: 'Competency in setting up and configuring computer servers.', order: 3, createdAt: new Date().toISOString() },
    { id: 'coc-css-4', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Maintain and Repair Systems', description: 'Competency in maintaining and repairing computer systems and networks.', order: 4, createdAt: new Date().toISOString() },

    // VGD NC III COCs
    { id: 'coc-vgd-1', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'Logo & Print Media Design', description: 'Design logos and print media materials following industry standards.', order: 1, createdAt: new Date().toISOString() },
    { id: 'coc-vgd-2', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'UI/UX Design', description: 'Design user interfaces and user experiences for digital products.', order: 2, createdAt: new Date().toISOString() },
    { id: 'coc-vgd-3', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'Product Packaging Design', description: 'Design product packaging following commercial and regulatory standards.', order: 3, createdAt: new Date().toISOString() },
    { id: 'coc-vgd-4', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'Booth & Display Design', description: 'Design booths and display materials for events and exhibitions.', order: 4, createdAt: new Date().toISOString() },

    // Empowerment Technology COCs
    { id: 'coc-emp-1', subjectId: 'subject-emp-tech', adminId: 'super-admin-001', title: 'ICT Fundamentals', description: 'Understanding ICT concepts, online platforms, and digital tools.', order: 1, createdAt: new Date().toISOString() },
    { id: 'coc-emp-2', subjectId: 'subject-emp-tech', adminId: 'super-admin-001', title: 'Digital Literacy & Safety', description: 'Digital productivity, cybersecurity, and responsible digital citizenship.', order: 2, createdAt: new Date().toISOString() },
  ];
}

export function getDefaultLOs(): LearningOutcome[] {
  return [
    // CSS NC II - COC 1: Install and Configure Computer Systems
    { id: 'lo-css-1-1', cocId: 'coc-css-1', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Assemble computer hardware', description: 'Assemble and disassemble computer hardware components following ESD safety procedures.', performanceCriteria: ['Identify hardware components', 'Apply ESD safety measures', 'Install CPU, RAM, storage, and PSU', 'Connect peripherals and cables', 'Verify POST and hardware functionality'], order: 1, createdAt: new Date().toISOString() },
    { id: 'lo-css-1-2', cocId: 'coc-css-1', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Install OS and drivers', description: 'Install operating systems and device drivers for peripherals.', performanceCriteria: ['Prepare bootable installation media', 'Configure BIOS/UEFI boot settings', 'Install operating system', 'Install chipset and device drivers', 'Verify driver installation'], order: 2, createdAt: new Date().toISOString() },
    { id: 'lo-css-1-3', cocId: 'coc-css-1', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Install application software', description: 'Install and configure application software and utilities.', performanceCriteria: ['Identify software requirements', 'Install productivity software', 'Install utility and security software', 'Configure application settings', 'Verify software functionality'], order: 3, createdAt: new Date().toISOString() },
    { id: 'lo-css-1-4', cocId: 'coc-css-1', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Testing and documentation', description: 'Conduct system testing and prepare technical documentation.', performanceCriteria: ['Perform system benchmarks', 'Document hardware configuration', 'Document software installation', 'Create user guides', 'Maintain system records'], order: 4, createdAt: new Date().toISOString() },

    // CSS NC II - COC 2: Set-Up Computer Networks
    { id: 'lo-css-2-1', cocId: 'coc-css-2', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Install network cables', description: 'Install and terminate network cables according to standards.', performanceCriteria: ['Identify cable types (CAT5e, CAT6)', 'Crimp and terminate RJ-45 connectors', 'Test cable continuity', 'Install cable runs and patch panels', 'Label and document cable installations'], order: 1, createdAt: new Date().toISOString() },
    { id: 'lo-css-2-2', cocId: 'coc-css-2', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Network configuration', description: 'Set network configuration including IP addressing and subnetting.', performanceCriteria: ['Configure IP addresses', 'Set up subnet masks and gateways', 'Configure DNS settings', 'Test network connectivity', 'Document network configuration'], order: 2, createdAt: new Date().toISOString() },
    { id: 'lo-css-2-3', cocId: 'coc-css-2', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Router/Wi-Fi configuration', description: 'Configure router, Wi-Fi, wireless access point, and repeater.', performanceCriteria: ['Access router admin interface', 'Configure SSID and wireless security', 'Set up DHCP', 'Configure access points and repeaters', 'Test wireless connectivity'], order: 3, createdAt: new Date().toISOString() },
    { id: 'lo-css-2-4', cocId: 'coc-css-2', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Inspect and test networks', description: 'Inspect and test configured computer networks.', performanceCriteria: ['Use ping and traceroute', 'Verify network speeds', 'Check for connectivity issues', 'Document test results', 'Resolve basic network issues'], order: 4, createdAt: new Date().toISOString() },

    // CSS NC II - COC 3: Set-Up Computer Servers
    { id: 'lo-css-3-1', cocId: 'coc-css-3', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'User access', description: 'Set up user access and permissions on servers.', performanceCriteria: ['Create user accounts', 'Set permissions and access levels', 'Configure group policies', 'Implement password policies', 'Document user access setup'], order: 1, createdAt: new Date().toISOString() },
    { id: 'lo-css-3-2', cocId: 'coc-css-3', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Network services', description: 'Configure network services including DHCP, DNS, and file sharing.', performanceCriteria: ['Configure DHCP server', 'Set up DNS server', 'Enable file sharing services', 'Configure print services', 'Test all network services'], order: 2, createdAt: new Date().toISOString() },
    { id: 'lo-css-3-3', cocId: 'coc-css-3', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Testing and deployment', description: 'Perform testing, documentation, and pre-deployment procedures.', performanceCriteria: ['Test server functionality', 'Perform stress testing', 'Document server configuration', 'Create deployment checklist', 'Complete pre-deployment verification'], order: 3, createdAt: new Date().toISOString() },

    // CSS NC II - COC 4: Maintain and Repair Systems
    { id: 'lo-css-4-1', cocId: 'coc-css-4', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Plan maintenance', description: 'Plan and prepare for maintenance and repair of computer systems.', performanceCriteria: ['Create maintenance schedule', 'Identify required tools and materials', 'Review system documentation', 'Prepare backup procedures', 'Coordinate maintenance windows'], order: 1, createdAt: new Date().toISOString() },
    { id: 'lo-css-4-2', cocId: 'coc-css-4', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Maintain systems', description: 'Maintain computer systems and networks through preventive measures.', performanceCriteria: ['Perform hardware cleaning', 'Update operating systems', 'Run disk maintenance tools', 'Update antivirus definitions', 'Optimize system performance'], order: 2, createdAt: new Date().toISOString() },
    { id: 'lo-css-4-3', cocId: 'coc-css-4', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Diagnose faults', description: 'Diagnose faults in computer systems and networks.', performanceCriteria: ['Identify symptoms', 'Use diagnostic tools', 'Isolate problem components', 'Document fault diagnosis', 'Determine root cause'], order: 3, createdAt: new Date().toISOString() },
    { id: 'lo-css-4-4', cocId: 'coc-css-4', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Fix defects', description: 'Rectify and correct defects in computer systems and networks.', performanceCriteria: ['Replace faulty components', 'Repair software issues', 'Restore system configurations', 'Verify repairs', 'Document corrective actions'], order: 4, createdAt: new Date().toISOString() },
    { id: 'lo-css-4-5', cocId: 'coc-css-4', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Inspect and test', description: 'Inspect and test repaired computer systems and networks.', performanceCriteria: ['Perform post-repair testing', 'Verify system stability', 'Run performance benchmarks', 'Get user acceptance', 'Complete repair documentation'], order: 5, createdAt: new Date().toISOString() },

    // VGD NC III - COC 1: Logo & Print Media Design
    { id: 'lo-vgd-1-1', cocId: 'coc-vgd-1', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'Logo Design Fundamentals', description: 'Create logos following design principles and client requirements.', performanceCriteria: ['Apply design principles', 'Create logo concepts', 'Present designs to clients'], order: 1, createdAt: new Date().toISOString() },
    { id: 'lo-vgd-1-2', cocId: 'coc-vgd-1', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'Print Media Production', description: 'Design and produce print media materials.', performanceCriteria: ['Set up print files', 'Apply CMYK color mode', 'Prepare files for printing'], order: 2, createdAt: new Date().toISOString() },

    // VGD NC III - COC 2: UI/UX Design
    { id: 'lo-vgd-2-1', cocId: 'coc-vgd-2', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'User Interface Design', description: 'Design user interfaces for web and mobile applications.', performanceCriteria: ['Create wireframes', 'Design UI components', 'Apply accessibility standards'], order: 1, createdAt: new Date().toISOString() },
    { id: 'lo-vgd-2-2', cocId: 'coc-vgd-2', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'User Experience Research', description: 'Conduct UX research and usability testing.', performanceCriteria: ['Plan user research', 'Conduct usability tests', 'Analyze findings'], order: 2, createdAt: new Date().toISOString() },

    // VGD NC III - COC 3: Product Packaging Design
    { id: 'lo-vgd-3-1', cocId: 'coc-vgd-3', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'Packaging Structure Design', description: 'Design product packaging structures and dielines.', performanceCriteria: ['Create dieline templates', 'Apply structural design', 'Select materials'], order: 1, createdAt: new Date().toISOString() },
    { id: 'lo-vgd-3-2', cocId: 'coc-vgd-3', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'Packaging Graphics', description: 'Create graphic designs for product packaging.', performanceCriteria: ['Design label graphics', 'Apply branding elements', 'Prepare print-ready files'], order: 2, createdAt: new Date().toISOString() },

    // VGD NC III - COC 4: Booth & Display Design
    { id: 'lo-vgd-4-1', cocId: 'coc-vgd-4', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'Exhibition Booth Design', description: 'Design booth layouts and displays for events.', performanceCriteria: ['Plan booth layout', 'Create display designs', 'Prepare production files'], order: 1, createdAt: new Date().toISOString() },
    { id: 'lo-vgd-4-2', cocId: 'coc-vgd-4', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'Signage and Banner Design', description: 'Design signage and banner materials for displays.', performanceCriteria: ['Design large-format graphics', 'Apply visibility standards', 'Prepare output files'], order: 2, createdAt: new Date().toISOString() },

    // Empowerment Technology - COC 1
    { id: 'lo-emp-1-1', cocId: 'coc-emp-1', subjectId: 'subject-emp-tech', adminId: 'super-admin-001', title: 'ICT and Society', description: 'Understand the impact of ICT on society and daily life.', performanceCriteria: ['Identify ICT applications', 'Analyze societal impact'], order: 1, createdAt: new Date().toISOString() },
    { id: 'lo-emp-1-2', cocId: 'coc-emp-1', subjectId: 'subject-emp-tech', adminId: 'super-admin-001', title: 'Online Platforms', description: 'Use online platforms and collaboration tools effectively.', performanceCriteria: ['Navigate cloud services', 'Use collaboration tools'], order: 2, createdAt: new Date().toISOString() },
    { id: 'lo-emp-1-3', cocId: 'coc-emp-1', subjectId: 'subject-emp-tech', adminId: 'super-admin-001', title: 'Digital Productivity', description: 'Use digital productivity tools for academic and professional work.', performanceCriteria: ['Use office applications', 'Manage digital files'], order: 3, createdAt: new Date().toISOString() },

    // Empowerment Technology - COC 2
    { id: 'lo-emp-2-1', cocId: 'coc-emp-2', subjectId: 'subject-emp-tech', adminId: 'super-admin-001', title: 'Internet Safety', description: 'Practice internet safety and cybersecurity awareness.', performanceCriteria: ['Apply password security', 'Recognize phishing'], order: 1, createdAt: new Date().toISOString() },
    { id: 'lo-emp-2-2', cocId: 'coc-emp-2', subjectId: 'subject-emp-tech', adminId: 'super-admin-001', title: 'Digital Citizenship', description: 'Practice responsible digital citizenship and online advocacy.', performanceCriteria: ['Practice ethical online behavior', 'Protect digital privacy'], order: 2, createdAt: new Date().toISOString() },
  ];
}

export function getDefaultContents(): Content[] {
  return [
    // CSS NC II - COC1 LO1
    { id: 'c-css-1-1-a', loId: 'lo-css-1-1', cocId: 'coc-css-1', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'Computer Hardware Components', content: 'A computer system consists of hardware and software components. Hardware includes the motherboard, CPU, RAM, storage devices, power supply unit (PSU), and peripherals. Understanding each component is essential for proper assembly.', order: 0, createdAt: new Date().toISOString() },
    { id: 'c-css-1-1-b', loId: 'lo-css-1-1', cocId: 'coc-css-1', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'ESD Safety Procedures', content: 'Electrostatic Discharge (ESD) can damage sensitive computer components. Always wear an anti-static wrist strap, work on an anti-static mat, and avoid touching component contacts directly. Ground yourself before handling components.', order: 1, createdAt: new Date().toISOString() },
    { id: 'c-css-1-1-c', loId: 'lo-css-1-1', cocId: 'coc-css-1', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'youtube', title: 'PC Assembly Tutorial', content: 'https://www.youtube.com/watch?v=BL4DCEp7blY', order: 2, createdAt: new Date().toISOString() },

    // CSS NC II - COC1 LO2
    { id: 'c-css-1-2-a', loId: 'lo-css-1-2', cocId: 'coc-css-1', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'OS Installation Steps', content: '1. Create bootable media (USB/DVD)\n2. Configure BIOS/UEFI boot order\n3. Boot from installation media\n4. Follow installation wizard\n5. Configure initial settings\n6. Install device drivers in correct order: Chipset → Graphics → Network → Audio → Peripherals', order: 0, createdAt: new Date().toISOString() },
    { id: 'c-css-1-2-b', loId: 'lo-css-1-2', cocId: 'coc-css-1', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'youtube', title: 'Windows Installation Guide', content: 'https://www.youtube.com/watch?v=H_MqXe_yJyA', order: 1, createdAt: new Date().toISOString() },

    // CSS NC II - COC1 LO3
    { id: 'c-css-1-3-a', loId: 'lo-css-1-3', cocId: 'coc-css-1', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'Essential Applications', content: 'Key software categories:\n- Office suites (Microsoft Office, LibreOffice)\n- Web browsers (Chrome, Firefox, Edge)\n- Antivirus and security software\n- Utility programs (compression, backup)\n- Communication tools', order: 0, createdAt: new Date().toISOString() },

    // CSS NC II - COC1 LO4
    { id: 'c-css-1-4-a', loId: 'lo-css-1-4', cocId: 'coc-css-1', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'Documentation Standards', content: 'Proper documentation includes:\n- Hardware specifications inventory\n- Software installation records\n- Network configuration diagrams\n- Troubleshooting logs\n- User guides and manuals\nAll records must be accurate and regularly updated.', order: 0, createdAt: new Date().toISOString() },

    // CSS NC II - COC2 LO1
    { id: 'c-css-2-1-a', loId: 'lo-css-2-1', cocId: 'coc-css-2', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'Network Cable Types', content: 'CAT5e: 1Gbps, 100m max distance\nCAT6: 10Gbps up to 55m, 1Gbps at 100m\nCAT6a: 10Gbps at 100m\n\nWiring standards: T568A and T568B. Use T568B for straight-through cables and cross-connect for crossover cables.', order: 0, createdAt: new Date().toISOString() },
    { id: 'c-css-2-1-b', loId: 'lo-css-2-1', cocId: 'coc-css-2', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'youtube', title: 'Network Cabling Tutorial', content: 'https://www.youtube.com/watch?v=4W9PE1x8MGI', order: 1, createdAt: new Date().toISOString() },

    // CSS NC II - COC2 LO2
    { id: 'c-css-2-2-a', loId: 'lo-css-2-2', cocId: 'coc-css-2', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'IP Addressing', content: 'IPv4 Address Classes:\nClass A: 1.0.0.0 to 126.0.0.0 (large networks)\nClass B: 128.0.0.0 to 191.255.0.0 (medium networks)\nClass C: 192.0.0.0 to 223.255.255.0 (small networks)\n\nSubnet masks define network and host portions of an address.', order: 0, createdAt: new Date().toISOString() },

    // CSS NC II - COC2 LO3
    { id: 'c-css-2-3-a', loId: 'lo-css-2-3', cocId: 'coc-css-2', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'Router Configuration', content: 'Router setup essentials:\n1. Access router admin panel (usually 192.168.1.1)\n2. Set admin password\n3. Configure SSID and wireless security (WPA2/WPA3)\n4. Set up DHCP address range\n5. Configure port forwarding if needed\n6. Update router firmware', order: 0, createdAt: new Date().toISOString() },

    // CSS NC II - COC2 LO4
    { id: 'c-css-2-4-a', loId: 'lo-css-2-4', cocId: 'coc-css-2', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'Network Testing Tools', content: 'Essential testing commands:\n- ping: Tests connectivity to a host\n- ipconfig/ifconfig: Shows network configuration\n- traceroute/tracert: Shows routing path\n- netstat: Shows active network connections\n- nslookup: DNS lookup tool', order: 0, createdAt: new Date().toISOString() },

    // CSS NC II - COC3 LO1-3
    { id: 'c-css-3-1-a', loId: 'lo-css-3-1', cocId: 'coc-css-3', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'User Account Types', content: 'Server user account types:\n- Administrator: Full system access\n- Standard User: Limited daily access\n- Guest: Temporary restricted access\n\nBest practices: Use least privilege principle, strong password policies, and regular access audits.', order: 0, createdAt: new Date().toISOString() },
    { id: 'c-css-3-2-a', loId: 'lo-css-3-2', cocId: 'coc-css-3', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'Network Services', content: 'Key server services:\n- DHCP: Automatic IP address assignment\n- DNS: Domain name resolution\n- File Sharing: Centralized file storage\n- Print Services: Shared printer management\n- Active Directory: Centralized user management', order: 0, createdAt: new Date().toISOString() },
    { id: 'c-css-3-3-a', loId: 'lo-css-3-3', cocId: 'coc-css-3', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'Pre-Deployment Checklist', content: 'Before deployment:\n1. Verify all services are running\n2. Test user access and permissions\n3. Perform backup procedures\n4. Document server configuration\n5. Create disaster recovery plan\n6. Get stakeholder sign-off', order: 0, createdAt: new Date().toISOString() },

    // CSS NC II - COC4 LO1-5
    { id: 'c-css-4-1-a', loId: 'lo-css-4-1', cocId: 'coc-css-4', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'Maintenance Planning', content: 'Preventive maintenance schedule:\n- Daily: Virus scans, backup verification\n- Weekly: Disk cleanup, temp files removal\n- Monthly: System updates, performance review\n- Quarterly: Hardware inspection, deep cleaning\n- Annually: Full system audit', order: 0, createdAt: new Date().toISOString() },
    { id: 'c-css-4-2-a', loId: 'lo-css-4-2', cocId: 'coc-css-4', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'System Maintenance Procedures', content: 'Regular maintenance tasks:\n- Clean hardware (dust removal, thermal paste)\n- Update operating system and software\n- Run disk defragmentation/optimization\n- Monitor system temperatures\n- Review and clear event logs', order: 0, createdAt: new Date().toISOString() },
    { id: 'c-css-4-3-a', loId: 'lo-css-4-3', cocId: 'coc-css-4', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'Troubleshooting Steps', content: 'CompTIA troubleshooting methodology:\n1. Identify the problem\n2. Establish a theory of probable cause\n3. Test the theory\n4. Establish a plan of action\n5. Implement the solution\n6. Verify full system functionality\n7. Document findings', order: 0, createdAt: new Date().toISOString() },
    { id: 'c-css-4-4-a', loId: 'lo-css-4-4', cocId: 'coc-css-4', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'Common Repairs', content: 'Frequent repair scenarios:\n- Replace failing hard drives\n- Fix overheating (clean fans, reapply thermal paste)\n- Repair corrupted OS (System Restore, repair install)\n- Replace damaged RAM modules\n- Fix network connectivity issues', order: 0, createdAt: new Date().toISOString() },
    { id: 'c-css-4-5-a', loId: 'lo-css-4-5', cocId: 'coc-css-4', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', type: 'text', title: 'Post-Repair Testing', content: 'After repairs:\n1. Boot system and check POST\n2. Verify all hardware is detected\n3. Run diagnostic software\n4. Test specific repaired components\n5. Perform stress tests\n6. Get user confirmation\n7. Document all repairs and results', order: 0, createdAt: new Date().toISOString() },

    // VGD NC III Contents (sample)
    { id: 'c-vgd-1-1-a', loId: 'lo-vgd-1-1', cocId: 'coc-vgd-1', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', type: 'text', title: 'Logo Design Principles', content: 'The five principles of effective logo design:\n1. Simple - Easy to recognize\n2. Memorable - Makes a lasting impression\n3. Timeless - Effective across eras\n4. Versatile - Works in various sizes and contexts\n5. Appropriate - Suitable for the target audience', order: 0, createdAt: new Date().toISOString() },
    { id: 'c-vgd-1-2-a', loId: 'lo-vgd-1-2', cocId: 'coc-vgd-1', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', type: 'text', title: 'Print Basics', content: 'Print design essentials:\n- CMYK color mode for printing\n- Resolution: 300 DPI minimum\n- Bleed area: Usually 3mm around edges\n- Safe zone: Keep important content inside margins', order: 0, createdAt: new Date().toISOString() },

    // Empowerment Technology Contents (sample)
    { id: 'c-emp-1-1-a', loId: 'lo-emp-1-1', cocId: 'coc-emp-1', subjectId: 'subject-emp-tech', adminId: 'super-admin-001', type: 'text', title: 'ICT in Daily Life', content: 'Information and Communication Technology impacts education, business, healthcare, and social connections. Understanding ICT enables us to be productive and connected in the digital age.', order: 0, createdAt: new Date().toISOString() },
    { id: 'c-emp-2-1-a', loId: 'lo-emp-2-1', cocId: 'coc-emp-2', subjectId: 'subject-emp-tech', adminId: 'super-admin-001', type: 'text', title: 'Cybersecurity Basics', content: 'Key cybersecurity practices:\n- Use strong, unique passwords\n- Enable two-factor authentication\n- Recognize phishing emails and websites\n- Keep software and OS updated\n- Use encrypted connections (HTTPS)', order: 0, createdAt: new Date().toISOString() },
  ];
}

export function getDefaultQuizzes(): Quiz[] {
  return [
    // CSS NC II Quizzes
    { id: 'quiz-css-1-1', loId: 'lo-css-1-1', cocId: 'coc-css-1', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Assemble Hardware - Post Test', description: 'Test your knowledge of hardware assembly.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-css-1-2', loId: 'lo-css-1-2', cocId: 'coc-css-1', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'OS & Drivers - Post Test', description: 'Test your OS installation knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-css-1-3', loId: 'lo-css-1-3', cocId: 'coc-css-1', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Application Software - Post Test', description: 'Test your software installation knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-css-1-4', loId: 'lo-css-1-4', cocId: 'coc-css-1', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Testing & Documentation - Post Test', description: 'Test your documentation knowledge.', passingScore: 80, createdAt: new Date().toISOString() },

    { id: 'quiz-css-2-1', loId: 'lo-css-2-1', cocId: 'coc-css-2', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Network Cables - Post Test', description: 'Test your cabling knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-css-2-2', loId: 'lo-css-2-2', cocId: 'coc-css-2', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Network Config - Post Test', description: 'Test your networking knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-css-2-3', loId: 'lo-css-2-3', cocId: 'coc-css-2', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Router/Wi-Fi - Post Test', description: 'Test your router knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-css-2-4', loId: 'lo-css-2-4', cocId: 'coc-css-2', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Network Testing - Post Test', description: 'Test your network testing knowledge.', passingScore: 80, createdAt: new Date().toISOString() },

    { id: 'quiz-css-3-1', loId: 'lo-css-3-1', cocId: 'coc-css-3', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'User Access - Post Test', description: 'Test your user management knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-css-3-2', loId: 'lo-css-3-2', cocId: 'coc-css-3', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Network Services - Post Test', description: 'Test your server services knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-css-3-3', loId: 'lo-css-3-3', cocId: 'coc-css-3', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Testing & Deployment - Post Test', description: 'Test your deployment knowledge.', passingScore: 80, createdAt: new Date().toISOString() },

    { id: 'quiz-css-4-1', loId: 'lo-css-4-1', cocId: 'coc-css-4', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Maintenance Planning - Post Test', description: 'Test your planning knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-css-4-2', loId: 'lo-css-4-2', cocId: 'coc-css-4', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'System Maintenance - Post Test', description: 'Test your maintenance knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-css-4-3', loId: 'lo-css-4-3', cocId: 'coc-css-4', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Fault Diagnosis - Post Test', description: 'Test your diagnostic skills.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-css-4-4', loId: 'lo-css-4-4', cocId: 'coc-css-4', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Defect Repair - Post Test', description: 'Test your repair knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-css-4-5', loId: 'lo-css-4-5', cocId: 'coc-css-4', subjectId: 'subject-css-nc2', adminId: 'super-admin-001', title: 'Inspect & Test - Post Test', description: 'Test your testing knowledge.', passingScore: 80, createdAt: new Date().toISOString() },

    // VGD NC III Quizzes
    { id: 'quiz-vgd-1-1', loId: 'lo-vgd-1-1', cocId: 'coc-vgd-1', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'Logo Design - Post Test', description: 'Test your logo design knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-vgd-1-2', loId: 'lo-vgd-1-2', cocId: 'coc-vgd-1', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'Print Media - Post Test', description: 'Test your print design knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-vgd-2-1', loId: 'lo-vgd-2-1', cocId: 'coc-vgd-2', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'UI Design - Post Test', description: 'Test your UI design knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-vgd-2-2', loId: 'lo-vgd-2-2', cocId: 'coc-vgd-2', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'UX Research - Post Test', description: 'Test your UX research knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-vgd-3-1', loId: 'lo-vgd-3-1', cocId: 'coc-vgd-3', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'Packaging Structure - Post Test', description: 'Test your packaging knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-vgd-3-2', loId: 'lo-vgd-3-2', cocId: 'coc-vgd-3', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'Packaging Graphics - Post Test', description: 'Test your graphics knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-vgd-4-1', loId: 'lo-vgd-4-1', cocId: 'coc-vgd-4', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'Booth Design - Post Test', description: 'Test your booth design knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-vgd-4-2', loId: 'lo-vgd-4-2', cocId: 'coc-vgd-4', subjectId: 'subject-vgd-nc3', adminId: 'super-admin-001', title: 'Signage Design - Post Test', description: 'Test your signage design knowledge.', passingScore: 80, createdAt: new Date().toISOString() },

    // Empowerment Technology Quizzes
    { id: 'quiz-emp-1-1', loId: 'lo-emp-1-1', cocId: 'coc-emp-1', subjectId: 'subject-emp-tech', adminId: 'super-admin-001', title: 'ICT & Society - Post Test', description: 'Test your ICT knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-emp-1-2', loId: 'lo-emp-1-2', cocId: 'coc-emp-1', subjectId: 'subject-emp-tech', adminId: 'super-admin-001', title: 'Online Platforms - Post Test', description: 'Test your platform knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-emp-1-3', loId: 'lo-emp-1-3', cocId: 'coc-emp-1', subjectId: 'subject-emp-tech', adminId: 'super-admin-001', title: 'Productivity - Post Test', description: 'Test your productivity tools knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-emp-2-1', loId: 'lo-emp-2-1', cocId: 'coc-emp-2', subjectId: 'subject-emp-tech', adminId: 'super-admin-001', title: 'Internet Safety - Post Test', description: 'Test your cybersecurity knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
    { id: 'quiz-emp-2-2', loId: 'lo-emp-2-2', cocId: 'coc-emp-2', subjectId: 'subject-emp-tech', adminId: 'super-admin-001', title: 'Digital Citizenship - Post Test', description: 'Test your digital citizenship knowledge.', passingScore: 80, createdAt: new Date().toISOString() },
  ];
}

export function getDefaultQuestions(): Question[] {
  const questions: Question[] = [];
  let questionId = 1;

  const createQuestions = (quizId: string, loId: string, subjectId: string, questionsData: Array<{q: string, options: string[], correct: number}>) => {
    questionsData.forEach((data, index) => {
      questions.push({
        id: `q-${questionId++}`,
        quizId,
        loId,
        subjectId,
        question: data.q,
        options: data.options,
        correctAnswer: data.correct,
        order: index,
        createdAt: new Date().toISOString(),
      });
    });
  };

  // CSS NC II - COC1 LO1: Assemble Hardware (20 questions)
  createQuestions('quiz-css-1-1', 'lo-css-1-1', 'subject-css-nc2', [
    { q: 'What does CPU stand for?', options: ['Central Processing Unit', 'Computer Personal Unit', 'Central Processor Utility', 'Computer Processing Unit'], correct: 0 },
    { q: 'Which component stores data permanently?', options: ['RAM', 'CPU', 'Hard Drive', 'Cache'], correct: 2 },
    { q: 'What is the brain of the computer?', options: ['RAM', 'CPU', 'GPU', 'PSU'], correct: 1 },
    { q: 'Which memory is volatile?', options: ['ROM', 'SSD', 'RAM', 'HDD'], correct: 2 },
    { q: 'What does RAM stand for?', options: ['Random Access Memory', 'Read Access Memory', 'Random Application Memory', 'Ready Access Memory'], correct: 0 },
    { q: 'What is the main function of the motherboard?', options: ['Store data', 'Connect all components', 'Display output', 'Provide power'], correct: 1 },
    { q: 'Which component generates images for display?', options: ['CPU', 'GPU', 'RAM', 'PSU'], correct: 1 },
    { q: 'What does PSU stand for?', options: ['Power Supply Unit', 'Power System Unit', 'Primary Supply Unit', 'Power Storage Unit'], correct: 0 },
    { q: 'What is ESD?', options: ['Electronic System Design', 'Electrostatic Discharge', 'External Storage Device', 'Enhanced Security Driver'], correct: 1 },
    { q: 'What protects against ESD?', options: ['Rubber gloves', 'Anti-static wrist strap', 'Safety goggles', 'Hard hat'], correct: 1 },
    { q: 'Which is an input device?', options: ['Monitor', 'Printer', 'Keyboard', 'Speaker'], correct: 2 },
    { q: 'Which is an output device?', options: ['Mouse', 'Scanner', 'Monitor', 'Microphone'], correct: 2 },
    { q: 'What does BIOS stand for?', options: ['Basic Input/Output System', 'Binary Input System', 'Basic Internet Operating System', 'Basic Internal Output System'], correct: 0 },
    { q: 'What unit measures CPU speed?', options: ['Bytes', 'Hertz', 'Pixels', 'Volts'], correct: 1 },
    { q: 'What does USB stand for?', options: ['Universal Serial Bus', 'Universal System Bus', 'United Serial Bus', 'Universal Serial Buffer'], correct: 0 },
    { q: 'What is thermal paste used for?', options: ['Seal connections', 'Improve heat transfer', 'Clean components', 'Lubricate fans'], correct: 1 },
    { q: 'What is POST?', options: ['Power On Self Test', 'Power Off System Test', 'Primary Operating System Test', 'Power On Start Test'], correct: 0 },
    { q: 'Which storage has no moving parts?', options: ['HDD', 'SSD', 'DVD', 'Tape'], correct: 1 },
    { q: 'What type of memory is ROM?', options: ['Volatile', 'Non-volatile', 'Temporary', 'Cache'], correct: 1 },
    { q: 'What is the purpose of standoffs?', options: ['Hold CPU', 'Prevent motherboard shorting', 'Cool components', 'Connect storage'], correct: 1 },
  ]);

  // CSS NC II - COC1 LO2: Install OS & Drivers (20 questions)
  createQuestions('quiz-css-1-2', 'lo-css-1-2', 'subject-css-nc2', [
    { q: 'What is the first step in OS installation?', options: ['Install drivers', 'Create bootable media', 'Configure network', 'Install software'], correct: 1 },
    { q: 'What does UEFI replace?', options: ['RAM', 'BIOS', 'GPU', 'CPU'], correct: 1 },
    { q: 'Which is a common desktop OS?', options: ['iOS', 'Android', 'Windows', 'watchOS'], correct: 2 },
    { q: 'What is the correct driver installation order?', options: ['Audio first', 'Chipset first', 'Network first', 'Graphics first'], correct: 1 },
    { q: 'What does a bootable USB do?', options: ['Store music', 'Install operating systems', 'Print documents', 'Connect to internet'], correct: 1 },
    { q: 'What is a partition?', options: ['A type of RAM', 'A section of a hard drive', 'A network cable', 'A display port'], correct: 1 },
    { q: 'What file system does Windows use?', options: ['ext4', 'NTFS', 'APFS', 'FAT16'], correct: 1 },
    { q: 'What is a device driver?', options: ['A physical tool', 'Software for hardware communication', 'A network cable', 'A display type'], correct: 1 },
    { q: 'What happens during POST?', options: ['OS loads', 'Hardware self-test', 'Files download', 'Programs install'], correct: 1 },
    { q: 'What is the boot sequence?', options: ['Program loading order', 'Device startup order', 'File saving order', 'Network priority'], correct: 1 },
    { q: 'Which tool creates bootable USB on Windows?', options: ['Notepad', 'Rufus', 'Calculator', 'Paint'], correct: 1 },
    { q: 'What is a clean install?', options: ['Wiping and reinstalling OS', 'Cleaning hardware', 'Removing viruses', 'Updating software'], correct: 0 },
    { q: 'What is dual boot?', options: ['Two monitors', 'Two OS on one PC', 'Two keyboards', 'Two mice'], correct: 1 },
    { q: 'Where are drivers typically found?', options: ['Manufacturer website', 'Social media', 'News sites', 'Gaming platforms'], correct: 0 },
    { q: 'What is Device Manager used for?', options: ['Games', 'Managing hardware drivers', 'Email', 'Web browsing'], correct: 1 },
    { q: 'What is a system image?', options: ['Screenshot', 'Full backup of system', 'Wallpaper', 'Icon set'], correct: 1 },
    { q: 'What is Safe Mode?', options: ['Secure browsing', 'Minimal driver startup', 'Game mode', 'Sleep mode'], correct: 1 },
    { q: 'What does formatting a drive do?', options: ['Speed it up', 'Prepare it for use', 'Cool it down', 'Connect to network'], correct: 1 },
    { q: 'What is a recovery partition?', options: ['Extra storage', 'System restore area', 'Game storage', 'Music library'], correct: 1 },
    { q: 'What is Windows Update used for?', options: ['Games', 'System and security updates', 'Music', 'Photos'], correct: 1 },
  ]);

  // Generate 20 questions for remaining CSS LOs
  const cssLOs = ['lo-css-1-3', 'lo-css-1-4', 'lo-css-2-1', 'lo-css-2-2', 'lo-css-2-3', 'lo-css-2-4', 'lo-css-3-1', 'lo-css-3-2', 'lo-css-3-3', 'lo-css-4-1', 'lo-css-4-2', 'lo-css-4-3', 'lo-css-4-4', 'lo-css-4-5'];
  const cssQuizIds = ['quiz-css-1-3', 'quiz-css-1-4', 'quiz-css-2-1', 'quiz-css-2-2', 'quiz-css-2-3', 'quiz-css-2-4', 'quiz-css-3-1', 'quiz-css-3-2', 'quiz-css-3-3', 'quiz-css-4-1', 'quiz-css-4-2', 'quiz-css-4-3', 'quiz-css-4-4', 'quiz-css-4-5'];

  cssLOs.forEach((loId, idx) => {
    const qData: Array<{q: string, options: string[], correct: number}> = [];
    for (let i = 1; i <= 20; i++) {
      qData.push({ q: `Question ${i} for ${loId}?`, options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: (i - 1) % 4 });
    }
    createQuestions(cssQuizIds[idx], loId, 'subject-css-nc2', qData);
  });

  // VGD NC III Questions
  const vgdLOs = ['lo-vgd-1-1', 'lo-vgd-1-2', 'lo-vgd-2-1', 'lo-vgd-2-2', 'lo-vgd-3-1', 'lo-vgd-3-2', 'lo-vgd-4-1', 'lo-vgd-4-2'];
  const vgdQuizIds = ['quiz-vgd-1-1', 'quiz-vgd-1-2', 'quiz-vgd-2-1', 'quiz-vgd-2-2', 'quiz-vgd-3-1', 'quiz-vgd-3-2', 'quiz-vgd-4-1', 'quiz-vgd-4-2'];

  vgdLOs.forEach((loId, idx) => {
    const qData: Array<{q: string, options: string[], correct: number}> = [];
    for (let i = 1; i <= 20; i++) {
      qData.push({ q: `Question ${i} for ${loId}?`, options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: (i - 1) % 4 });
    }
    createQuestions(vgdQuizIds[idx], loId, 'subject-vgd-nc3', qData);
  });

  // Empowerment Technology Questions
  const empLOs = ['lo-emp-1-1', 'lo-emp-1-2', 'lo-emp-1-3', 'lo-emp-2-1', 'lo-emp-2-2'];
  const empQuizIds = ['quiz-emp-1-1', 'quiz-emp-1-2', 'quiz-emp-1-3', 'quiz-emp-2-1', 'quiz-emp-2-2'];

  empLOs.forEach((loId, idx) => {
    const qData: Array<{q: string, options: string[], correct: number}> = [];
    for (let i = 1; i <= 20; i++) {
      qData.push({ q: `Question ${i} for ${loId}?`, options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: (i - 1) % 4 });
    }
    createQuestions(empQuizIds[idx], loId, 'subject-emp-tech', qData);
  });

  return questions;
}
