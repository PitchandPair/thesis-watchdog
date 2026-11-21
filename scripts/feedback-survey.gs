// Creates the "Former Employee Workplace Survey" Google Form. Run createSurvey once.
function createSurvey() {
  var form = FormApp.create('Former Employee Workplace Survey');
  form.setDescription(
    'DEMO / SIMULATION: this form is a prototype. No one is being contacted and no payment will be made.\n\n' +
    'A short survey about what it was like to work at a company you have left. It takes about 3 minutes. ' +
    'We only want your general opinions. We do not want, and will not use, any confidential information.'
  );
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setProgressBar(true);
  form.setConfirmationMessage('Thank you. Your answers were recorded. DEMO: no payment is sent for this prototype.');

  var terms =
    'Please read these terms. You must agree to all of them to take part.\n\n' +
    '1. WHO CAN TAKE PART. Only former employees who left the company more than 12 months ago. You may not take part if you are a current employee, contractor, consultant, officer or director of the company, or a close family member of one.\n\n' +
    '2. OPINIONS ONLY. We ask only for your general, personal opinions about what it was like to work there.\n\n' +
    '3. DO NOT SHARE CONFIDENTIAL INFORMATION. Do not share any of the following, in any answer:\n' +
    '   - Material non-public information: anything not publicly known that an investor could consider important. Examples: unreleased financial results or forecasts, sales or customer figures, pending deals, unannounced products, plans or layoffs, legal or regulatory matters.\n' +
    '   - Trade secrets, or confidential or proprietary information of the company or anyone else.\n' +
    '   - Anything you agreed to keep private under an employment, confidentiality (NDA) or separation agreement.\n' +
    '   - Classified or export-controlled information.\n' +
    '   - Personal information about other people.\n' +
    '   If you are not sure whether something is confidential, leave it out.\n\n' +
    '4. NO BREACH OF YOUR DUTIES. You confirm that taking part does not break any agreement you signed or any duty you owe to the company or anyone else.\n\n' +
    '5. THANK-YOU PAYMENT. Eligible participants receive a $50 thank-you for their time. The amount is the same whatever you answer. It is not payment for any particular information or opinion. One per person. (DEMO: payments are simulated. No money is sent.)\n\n' +
    '6. WE WILL DELETE RESTRICTED CONTENT. Any answer that appears to contain confidential or non-public information will be deleted and not used.\n\n' +
    '7. HOW ANSWERS ARE USED. Answers are combined with other people\'s into an overall employee-sentiment score shown in a research tool. Individual answers are not published. The tool is informational only and does not give investment advice.\n\n' +
    '8. VOLUNTARY. Taking part is your choice. You can stop at any time.';
  form.addSectionHeaderItem().setTitle('Terms of participation').setHelpText(terms);

  var agree = form.addCheckboxItem().setTitle('Tick every box to confirm').setRequired(true);
  agree.setChoiceValues([
    'I left the company more than 12 months ago',
    'I am not a current employee, contractor, consultant, officer or director of the company, or a close family member of one',
    'I will not share material non-public, confidential, proprietary, trade secret or classified information',
    'Taking part does not break any agreement I signed or any duty I owe to anyone',
    'I understand the $50 is for my time and is the same whatever I answer',
    'I have read and agree to all the terms above'
  ]);
  agree.setValidation(FormApp.createCheckboxValidation().setHelpText('You must tick all six boxes to take part.').requireSelectAtLeast(6).build());
  form.addTextItem().setTitle('Type your full name as your signature').setRequired(true);

  var about = form.addPageBreakItem().setTitle('About you');
  form.addListItem().setTitle('Which company did you work at?').setRequired(true).setChoiceValues([
    'NVIDIA (NVDA)', 'Advanced Micro Devices (AMD)', 'Taiwan Semiconductor (TSM)', 'Micron (MU)', 'Lam Research (LRCX)', 'ASML (ASML)',
    'Broadcom (AVGO)', 'Intel (INTC)', 'Qualcomm (QCOM)', 'Applied Materials (AMAT)', 'SpaceX (SPCX)', 'Anthropic (ANT)'
  ]);
  var left = form.addMultipleChoiceItem().setTitle('How long ago did you leave?').setRequired(true);
  form.addListItem().setTitle('Which area did you work in?').setRequired(true).setChoiceValues([
    'Engineering or research', 'Sales or marketing', 'Operations or manufacturing', 'Finance, legal or HR', 'Other'
  ]);

  var exp = form.addPageBreakItem().setTitle('Your experience')
    .setHelpText('General opinions only. No confidential details, figures, customer names or unreleased plans.');
  var scale = function (title) {
    form.addScaleItem().setTitle(title).setBounds(1, 5).setLabels('Very poor', 'Excellent').setRequired(true);
  };
  scale('Overall, how would you rate it as a place to work?');
  scale('Confidence in senior leadership while you were there');
  scale('Culture and values');
  scale('Work-life balance');
  scale('Pay and benefits');
  scale('Career growth');
  form.addMultipleChoiceItem().setTitle('Would you recommend working there to a friend?').setRequired(true).setChoiceValues(['Yes', 'No', 'Not sure']);
  form.addParagraphTextItem()
    .setTitle('Optional: in general terms, what was the best and the worst thing about working there?')
    .setHelpText('Opinions only. Do not include confidential or non-public information, numbers, customer names or unreleased products. Answers that do will be deleted.')
    .setValidation(FormApp.createParagraphTextValidation().setHelpText('Please keep it under 500 characters.').requireTextLengthLessThanOrEqualTo(500).build());

  var pay = form.addPageBreakItem().setTitle('Thank-you payment')
    .setHelpText('DEMO: payments are simulated. No money is sent and you do not need to give any payment details.');
  form.addTextItem().setTitle('Email address for the $50 thank-you (optional in this demo)')
    .setValidation(FormApp.createTextValidation().setHelpText('Enter a valid email address.').requireTextIsEmail().build());

  // Anyone who left less than 12 months ago is not eligible: the form ends there.
  left.setChoices([
    left.createChoice('Less than 12 months ago (not eligible, the survey ends here)', FormApp.PageNavigationType.SUBMIT),
    left.createChoice('1 to 2 years ago', FormApp.PageNavigationType.CONTINUE),
    left.createChoice('2 to 5 years ago', FormApp.PageNavigationType.CONTINUE),
    left.createChoice('More than 5 years ago', FormApp.PageNavigationType.CONTINUE)
  ]);

  Logger.log('EDIT: ' + form.getEditUrl());
  Logger.log('LIVE: ' + form.getPublishedUrl());
}
