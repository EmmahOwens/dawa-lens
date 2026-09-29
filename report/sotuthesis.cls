%% ============================================================
%%  sotuthesis.cls
%%  Soroti University -- Electronics and Computer Engineering
%%  Shared class file for Proposal / Interim Report / Final Thesis
%%
%%  This single class file is used by all three independent
%%  templates so that page geometry, headings, fonts, the cover
%%  page, and front-matter commands stay IDENTICAL across the
%%  three document types. Each main .tex file (proposal/interim/
%%  final) loads this class and only differs in which sections
%%  of front matter and which chapters it actually uses.
%%
%%  This template was developed by Dr. Ann Move Oguti. Special thanks to the reviewers: the deputy dean SET, Dr. Excellence Favor, HODs: Dr. Hellen Aluku, Dr. Musa Chemisto, Dr. Raphael Naryongo and Mr. Balinda Roland Mujungu, Admis: Me. Benard Wafula and Mr. Fabian Ebiju Dickens
%% ============================================================

\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{sotuthesis}[2026/06/21 v1.0 Soroti University Report Class]

%% ---------- Class options ----------
% \documentclass[proposal]{sotuthesis}
% \documentclass[interim]{sotuthesis}
% \documentclass[final]{sotuthesis}
\newcommand{\@reporttype}{final}
\DeclareOption{proposal}{\renewcommand{\@reporttype}{proposal}}
\DeclareOption{interim}{\renewcommand{\@reporttype}{interim}}
\DeclareOption{final}{\renewcommand{\@reporttype}{final}}
\DeclareOption*{\PassOptionsToClass{\CurrentOption}{report}}
\ProcessOptions\relax

\LoadClass[12pt,twoside]{report}

%% ---------- Core packages ----------
\RequirePackage[utf8]{inputenc}
\RequirePackage[T1]{fontenc}
\RequirePackage{times}                 % Times New Roman equivalent
\RequirePackage[a4paper]{geometry}
\RequirePackage{setspace}
\RequirePackage{titlesec}
\RequirePackage{titletoc}
\RequirePackage{tocloft}
\RequirePackage{fancyhdr}
\RequirePackage{graphicx}
\RequirePackage{xcolor}
\RequirePackage{caption}
\RequirePackage{enumitem}
\RequirePackage{amsmath,amssymb}
\RequirePackage[hidelinks]{hyperref}
\RequirePackage{microtype}
\RequirePackage{xstring}
\RequirePackage{indentfirst}
\RequirePackage{etoolbox}

%% ---------- Page geometry ----------
% Text area approx. 160mm x 247mm as in the source guide,
% A4 paper, suitable margins for double-sided binding.
\geometry{
  a4paper,
  left=30mm,
  right=25mm,
  top=25mm,
  bottom=25mm,
  headheight=14pt,
  headsep=8mm
}

%% ---------- Line spacing & paragraph ----------
\onehalfspacing
\setlength{\parindent}{1.25em}
\raggedbottom

%% ---------- Float placement constraints & spacing ----------
% Prevent floats from being rejected to float-only pages or pushed far forward
\renewcommand{\topfraction}{0.85}
\renewcommand{\bottomfraction}{0.80}
\renewcommand{\textfraction}{0.12}
\renewcommand{\floatpagefraction}{0.75}
\setcounter{topnumber}{3}
\setcounter{bottomnumber}{3}
\setcounter{totalnumber}{5}

% Tighten float separation to eliminate excessive vertical whitespace
\setlength{\floatsep}{10pt plus 2pt minus 2pt}
\setlength{\textfloatsep}{12pt plus 2pt minus 3pt}
\setlength{\intextsep}{10pt plus 2pt minus 2pt}
\setlength{\abovecaptionskip}{6pt}
\setlength{\belowcaptionskip}{4pt}

% Enforce single-spacing in tables and figures so floats fit cleanly
\AtBeginEnvironment{table}{\singlespacing}
\AtBeginEnvironment{figure}{\singlespacing}

%% ---------- Headings (Table 4.1 style: 4 levels) ----------
% Level 1 - Chapter: centered, large, number and title on one line
\titleformat{\chapter}
  {\centering\normalfont\bfseries\fontsize{18pt}{22pt}\selectfont}
  {\chaptertitlename\ \thechapter}
  {0.6em}
  {}
\titlespacing*{\chapter}{0pt}{0pt}{16pt}

% Level 2 - Section: left aligned, bold
\titleformat{\section}
  {\normalfont\bfseries\fontsize{14pt}{17pt}\selectfont}
  {\thesection}{1em}{}
\titlespacing*{\section}{0pt}{11pt}{5pt}

% Level 3 - Subsection
\titleformat{\subsection}
  {\normalfont\bfseries\fontsize{13pt}{16pt}\selectfont}
  {\thesubsection}{1em}{}
\titlespacing*{\subsection}{0pt}{9pt}{4pt}

% Level 4 - Subsubsection
\titleformat{\subsubsection}
  {\normalfont\bfseries\fontsize{12pt}{15pt}\selectfont}
  {\thesubsubsection}{1em}{}
\titlespacing*{\subsubsection}{0pt}{7pt}{3pt}

\setcounter{secnumdepth}{4}
\setcounter{tocdepth}{3}

%% ---------- Headers / Footers ----------
% Page numbers centered at the bottom, flanked by dashes: -3-
% Header: report title on the left (verso) / chapter title on
% the right (recto), 10.5pt, added from the abstract page onward.
\fancypagestyle{sotufront}{
  \fancyhf{}
  \fancyfoot[C]{\thepage}
  \renewcommand{\headrulewidth}{0pt}
  \renewcommand{\footrulewidth}{0pt}
}

\fancypagestyle{sotumain}{
  \fancyhf{}
  \fancyhead[L]{\small\sotu@headertitle}
  \fancyhead[R]{}
  \fancyfoot[C]{\textendash\ \thepage\ \textendash}
  \renewcommand{\headrulewidth}{0.4pt}
  \renewcommand{\footrulewidth}{0pt}
}
\pagestyle{sotumain}

% LaTeX automatically switches to the "plain" pagestyle on the
% first page of every \chapter.
\fancypagestyle{plain}{
  \fancyhf{}
  \fancyhead[L]{\small\sotu@headertitle}
  \fancyhead[R]{}
  \fancyfoot[C]{\textendash\ \thepage\ \textendash}
  \renewcommand{\headrulewidth}{0.4pt}
  \renewcommand{\footrulewidth}{0pt}
}

% Used for front-matter pages that should NOT show the running
% header (Statement of Originality, Copyright Authorization,
% Approval, Dedication, Acknowledgements) but should still be
% numbered, continuing the roman-numeral page sequence.
\fancypagestyle{sotunoheader}{
  \fancyhf{}
  \fancyfoot[C]{\textendash\ \thepage\ \textendash}
  \renewcommand{\headrulewidth}{0pt}
  \renewcommand{\footrulewidth}{0pt}
}

% Custom "-N-" page number style used after \pagenumbering{arabic}
\renewcommand{\thepage}{\arabic{page}}

\newcommand{\sotu@headertitle}{Soroti University}
\newcommand{\setheadertitle}[1]{\renewcommand{\sotu@headertitle}{#1}}

% Right-hand running head shows "Chapter N  <Chapter Title>" via
% \rightmark, updated automatically whenever \chapter is used.
% It intentionally never switches to the section title, so it
% stays constant for the whole chapter (matching the example image).
% Uses \@chapapp rather than \chaptername so it correctly reads
% "Appendix" instead of "Chapter" after \appendix is called.
\renewcommand{\chaptermark}[1]{\markright{\ifnum\c@chapter>0 \@chapapp\ \thechapter\ \ \fi#1}}

% \section headings must NOT update the running header -- only
% \chapter should. By default report.cls's \@sect machinery calls
% \markright for every sectioning command that has one, which
% would otherwise overwrite the chapter-level mark set above as
% soon as the reader reaches the page containing a \section.
\renewcommand{\sectionmark}[1]{}

%% ---------- Front matter metadata commands ----------
% Sensible fallback values so the template still compiles
% even before the student fills everything in. Defined first
% with \newcommand; the setter macros below use \renewcommand
% so calling e.g. \reporttitle{...} in main.tex never clashes.
\newcommand{\@reporttitle}{[Insert Dissertation / Project Title]}
\newcommand{\@studentname}{[Student Full Name]}
\newcommand{\@studentnumber}{[Registration / Student Number]}
\newcommand{\@programme}{Bachelor of Engineering in Electronics and Computer Engineering}
\newcommand{\@supervisorname}{[Supervisor Name]}
\newcommand{\@cosupervisorname}{}
\newcommand{\@departmentname}{Department of Electronics and Computer Engineering}
\newcommand{\@facultyname}{School of Engineering and Technology}
\newcommand{\@submissiondate}{Month, Year}
\newcommand{\@universitylogo}{}
\newcommand{\@schoolname}{SCHOOL OF ENGINEERING AND TECHNOLOGY}
\newcommand{\@coursecode}{GEC4101 Research Project}

% These are called in each report's main.tex preamble, e.g.
% \reporttitle{My Dissertation Title}
\newcommand{\reporttitle}[1]{\renewcommand{\@reporttitle}{#1}}
\newcommand{\studentname}[1]{\renewcommand{\@studentname}{#1}}
\newcommand{\studentnumber}[1]{\renewcommand{\@studentnumber}{#1}}
\newcommand{\programme}[1]{\renewcommand{\@programme}{#1}}
\newcommand{\supervisorname}[1]{\renewcommand{\@supervisorname}{#1}}
\newcommand{\cosupervisorname}[1]{\renewcommand{\@cosupervisorname}{#1}}
\newcommand{\departmentname}[1]{\renewcommand{\@departmentname}{#1}}
\newcommand{\facultyname}[1]{\renewcommand{\@facultyname}{#1}}
\newcommand{\submissiondate}[1]{\renewcommand{\@submissiondate}{#1}}
\newcommand{\universitylogo}[1]{\renewcommand{\@universitylogo}{#1}}
\newcommand{\schoolname}[1]{\renewcommand{\@schoolname}{#1}}
\newcommand{\coursecode}[1]{\renewcommand{\@coursecode}{#1}}

%% ---------- Report-type label (auto text used on the cover) ----------
\newcommand{\getreportlabel}{%
  \csname sotu@label@\@reporttype\endcsname
}
\newcommand{\sotu@label@proposal}{GEC4101 Research Project Proposal Report}
\newcommand{\sotu@label@interim}{GEC4101 Research Project Interim Report}
\newcommand{\sotu@label@final}{GEC4101 Research Project Report}

%% ---------- Cover Page (hard cover) ----------
\newcommand{\makecoverpage}{
  \begingroup
  \singlespacing
  \thispagestyle{empty}
  \begin{center}
    \vspace*{0.4cm}

    % University logo. Replace the file path below with your own
    % logo image (e.g. \universitylogo{figures/soroti-logo.png} in
    % main.tex). Until then a placeholder box is shown.
    \IfStrEq{\@universitylogo}{}{%
      \fbox{\parbox[c][55mm][c]{60mm}{\centering\small University\\Crest / Logo\\(insert image)}}%
    }{%
      \includegraphics[width=60mm,height=50mm]{\@universitylogo}%
    }

    \vspace{8mm}
    {\large\bfseries SOROTI UNIVERSITY\par}
    \vspace{2mm}
    {\normalsize\bfseries \@schoolname \par}
    \vspace{2mm}
    {\normalsize \@departmentname \par}

    \vspace{18mm}

    {\Large\bfseries \@reporttitle \par}

    \vspace{10mm}
    {\large \getreportlabel \par}

    \vspace{14mm}

    \begin{tabular}{r l}
      Submitted by: & \@studentname \\[2mm]
      Student No.: & \@studentnumber \\[2mm]
      Programme: & \@programme \\[2mm]
      Supervisor: & \@supervisorname \\
      \IfStrEq{\@cosupervisorname}{}{}{Co-Supervisor: & \@cosupervisorname \\}
    \end{tabular}

    \vfill
    {\normalsize \@submissiondate \par}
    \vspace{6mm}
  \end{center}
  \endgroup
  \clearpage
}

%% ---------- Title Page (repeats key info, plain) ----------
%% ---------- Title Page (repeats key info, plain) ----------
\newcommand{\maketitlepage}{
  \begingroup
  \singlespacing
  \thispagestyle{empty}
  \begin{center}
    \vspace*{1.5cm}
    {\Large\bfseries \@reporttitle \par}
    \vspace{1.2cm}
    {\large A \getreportlabel\par}
    \vspace{2mm}
    {\large submitted to the\par}
    \vspace{2mm}
    {\large \@departmentname\par}
    \vspace{7mm}
    {\large in partial fulfilment of the requirements for the degree of\par}
    \vspace{2mm}
    \begin{minipage}{0.6\linewidth}
      \centering\large \@programme\par
    \end{minipage}\par
    \vspace{1.2cm}
    {\large By\par}
    {\large\bfseries \@studentname \par}
    {\large \@studentnumber \par}
    \vspace{1.2cm}
    {\large Supervisor: \@supervisorname\par}
    \IfStrEq{\@cosupervisorname}{}{}{%
      {\large Co-Supervisor: \@cosupervisorname\par}%
    }
    \vfill
    %{\large Soroti University\par}
    \vspace{1.5cm}
  \end{center}
  \endgroup
  \clearpage
}

%% ---------- Classification / UDC page ----------
% This page follows the hard-cover (logo) page, per the NEU-style
% front matter sequence: hard cover -> classification/UDC page ->
% inside title page -> statement of originality -> copyright
% authorization -> approval -> abstract ...
% Classification Code, Security Classification, and UDC are left
% as blank fill-in lines (matching the source example), since these
% are normally completed by the registry/library, not the student.

\newcommand{\makeclassificationpage}{
  \begingroup
  \singlespacing
  \thispagestyle{empty}
  \noindent
  Classification Code \hrulefill\hspace{2mm}Security Classification \hrulefill

  \vspace{2mm}
  \noindent
  UDC \hrulefill

  \vspace{2cm}
  \begin{center}
    {\large \getreportlabel \par}

    \vspace{1.2cm}
    {\Large\bfseries \@reporttitle \par}

    \vspace{1.5cm}
  \end{center}

  \noindent
  \begin{tabular}{@{}p{5.8cm} p{9.2cm}}
    Author: & \@studentname \\[3mm]
    Supervisor: & \@supervisorname \\
    \IfStrEq{\@cosupervisorname}{}{}{ & \@cosupervisorname \\}
     & \@departmentname \\[3mm]
    Degree Application: & Bachelor \\[3mm]
    Subject Category: & Engineering \\[3mm]
    Major: & Electronics and Computer Engineering \\[3mm]
    Submission Date: & \@submissiondate \hspace{1.5cm} Defense Date: \hrulefill \\[3mm]
    Degree Awarding Date: & \hrulefill \\[3mm]
    Defense Committee Chairman: & \hrulefill \\[3mm]
  \end{tabular}

  \vfill
  \begin{center}
    {\bfseries Soroti University \par}
    {\bfseries \@submissiondate \par}
  \end{center}
  \endgroup
  \clearpage
}

%% ---------- Copyright Authorization page ----------
\newcommand{\makecopyrightauth}{
  \chapter*{Copyright Authorization}
  \addcontentsline{toc}{chapter}{Copyright Authorization}
  \thispagestyle{sotunoheader}
  \noindent
  The author and the supervisor are aware of Soroti University's
  regulations on retaining and using academic dissertations and reports:
  the University retains the right to keep and submit a copy of this work
  to relevant national departments and organizations, and this work may be
  consulted and borrowed. We agree that Soroti University may add all or
  part of this work to a relevant database for searching and academic
  communication purposes.

  \vspace{1cm}
  \noindent
  Preferred timing for online availability (tick one):

  \vspace{0.2cm}
  \begin{itemize}[leftmargin=2cm]
    \item[$\square$] Immediately upon graduation
    \item[$\square$] Half a year after graduation
    \item[$\square$] One year after graduation
    \item[$\square$] Two years after graduation
  \end{itemize}

  \vspace{1.5cm}
  \begin{flushright}
  \begin{tabular}{r l}
    Signature of Author: & \makebox[5cm]{\hrulefill} \\[4mm]
    Date: & \makebox[5cm]{\hrulefill} \\[10mm]
    Signature of Supervisor: & \makebox[5cm]{\hrulefill} \\[4mm]
    Date: & \makebox[5cm]{\hrulefill} \\
  \end{tabular}
  \end{flushright}
  \clearpage
}
% Shared fixed width for "Signature:" / "Date:" labels so their
% colons line up exactly, regardless of word length -- used with
% \makebox[\sotu@siglabelwidth][r]{...} on Declaration/Approval pages.
\newlength{\sotu@siglabelwidth}
\settowidth{\sotu@siglabelwidth}{Signature:}

\newcommand{\makedeclaration}{
  \chapter*{Statement of Declaration}
  \addcontentsline{toc}{chapter}{Statement of Declaration}
  \thispagestyle{sotunoheader}
  \noindent
  I, \@studentname, \@studentnumber, declare that this work is my own original effort and has
  not been submitted to any other institution for the award of a degree or
  any other academic credit. All sources of information used in this work
  have been duly acknowledged through complete references.

  \vspace{2cm}
  \begin{flushleft}
  \begin{minipage}[t]{8cm}
  \raggedright
  \makebox[\sotu@siglabelwidth][r]{Signature:}\hspace{2mm}\makebox[5cm]{\hrulefill}\\[4mm]
  %\@studentname \\
  %\@studentnumber \\[4mm]
  \makebox[\sotu@siglabelwidth][r]{Date:}\hspace{2mm}\makebox[5cm]{\hrulefill}\\[10mm]
  \end{minipage}
  \end{flushleft}
  \clearpage
}

%% ---------- Approval page ----------
\newcommand{\makeapproval}{
  \chapter*{Approval}
  \addcontentsline{toc}{chapter}{Approval}
  \thispagestyle{sotunoheader}
  \noindent
  This \getreportlabel\ has been submitted for examination with the approval
  of the undersigned supervisor(s).

  \vspace{2cm}
  \begin{flushleft}
  \begin{minipage}[t]{8cm}
  \raggedright
  \makebox[\sotu@siglabelwidth][r]{Signature:}\hspace{2mm}\makebox[5cm]{\hrulefill}\\[4mm]
  %\@supervisorname \\
  %Supervisor \\[4mm]
  \makebox[\sotu@siglabelwidth][r]{Date:}\hspace{2mm}\makebox[5cm]{\hrulefill}\\[10mm]
  \end{minipage}
  \end{flushleft}

  \IfStrEq{\@cosupervisorname}{}{}{%
    \vspace{1.5cm}
    \begin{flushleft}
    \begin{minipage}[t]{8cm}
    \raggedright
    \makebox[\sotu@siglabelwidth][r]{Signature:}\hspace{2mm}\makebox[5cm]{\hrulefill}\\[4mm]
    \@cosupervisorname \\
    Co-Supervisor \\[4mm]
    \makebox[\sotu@siglabelwidth][r]{Date:}\hspace{2mm}\makebox[5cm]{\hrulefill}\\[10mm]
    \end{minipage}
    \end{flushleft}
  }
  \clearpage
}

%% ---------- Abstract environment ----------
\newenvironment{thesisabstract}{
  \chapter*{Abstract}
  \addcontentsline{toc}{chapter}{Abstract}
  \thispagestyle{sotumain}
  \markright{Abstract}
}{
  \clearpage
}

%% ---------- Dedication ----------
\newenvironment{dedication}{
  \chapter*{Dedication}
  \addcontentsline{toc}{chapter}{Dedication}
  \thispagestyle{sotunoheader}
  \centering
}{
  \clearpage
}

%% ---------- Acknowledgement ----------
\newenvironment{acknowledgement}{
  \chapter*{Acknowledgements}
  \addcontentsline{toc}{chapter}{Acknowledgements}
  \thispagestyle{sotunoheader}
}{
  \clearpage
}

%% ---------- List of Abbreviations ----------
\newenvironment{abbreviations}{
  \chapter*{List of Abbreviations}
  \addcontentsline{toc}{chapter}{List of Abbreviations}
  \thispagestyle{sotumain}
  \markright{List of Abbreviations}
  \begingroup
  \singlespacing
  \begin{description}[style=multiline, leftmargin=2.8cm, font=\bfseries, noitemsep, topsep=4pt, parsep=2pt]
}{
  \end{description}
  \endgroup
  \clearpage
}

%% ---------- Front matter numbering (roman) and main matter (arabic) ----------
\newcommand{\frontmatterstart}{
  \pagenumbering{roman}
  \pagestyle{sotumain}
}
\newcommand{\mainmatterstart}{
  \clearpage
  \pagenumbering{arabic}
  \pagestyle{sotumain}
}

%% ---------- Figure / Table caption style ----------
\captionsetup[figure]{font=small, labelfont=bf, name=Figure}
\captionsetup[table]{font=small, labelfont=bf, name=Table}

%% ---------- Published Works (back matter) ----------
% For students who have published papers, conference proceedings,
% or patents arising from their research project. Placed after the
% Appendices in the final report only. Uses a numbered list, similar
% in spirit to the "academic achievements during doctoral studies"
% section of the source typesetting guide, adapted for undergraduate
% research projects. Unnumbered (chapter*) so it does not inherit
% the Appendix A/B/C lettering scheme from \appendix.
\newenvironment{publishedworks}{
  \chapter*{Published Works}
  \addcontentsline{toc}{chapter}{Published Works}
  \markright{Published Works}
  \begin{enumerate}[label={[\arabic*]}]
}{
  \end{enumerate}
  \clearpage
}

%% ---------- List of Figures / Tables headings into ToC ----------
\AtBeginDocument{
  \renewcommand{\listfigurename}{List of Figures}
  \renewcommand{\listtablename}{List of Tables}
  \renewcommand{\contentsname}{Table of Contents}
  \renewcommand{\bibname}{References}
  % Ensure the running header shows the correct title on the
  % Table of Contents / List of Figures / List of Tables pages
  % (including any continuation pages), since the kernel's own
  % \tableofcontents/\listoffigures/\listoftables call \markright
  % with an UPPERCASE title via \@mkboth -- override \@mkboth
  % within each command's scope so it uses our preferred title
  % and capitalisation instead, consistently on every page.
  \let\sotu@oldtoc\tableofcontents
  \renewcommand{\tableofcontents}{%
    \addcontentsline{toc}{chapter}{\contentsname}%
    \begingroup
    \def\@mkboth##1##2{\markright{\contentsname}}%
    \sotu@oldtoc
    \endgroup
    \clearpage
  }
  \let\sotu@oldlof\listoffigures
  \renewcommand{\listoffigures}{%
    \clearpage
    \addcontentsline{toc}{chapter}{\listfigurename}%
    \begingroup
    \def\@mkboth##1##2{\markright{\listfigurename}}%
    \sotu@oldlof
    \endgroup
    \IfStrEq{\@reporttype}{proposal}{\vspace{1.2cm}}{\clearpage}%
  }
  \let\sotu@oldlot\listoftables
  \renewcommand{\listoftables}{%
    \IfStrEq{\@reporttype}{proposal}{}{\clearpage}%
    \addcontentsline{toc}{chapter}{\listtablename}%
    \begingroup
    \def\@mkboth##1##2{\markright{\listtablename}}%
    \sotu@oldlot
    \endgroup
    \clearpage
  }
  \let\sotu@oldbib\thebibliography
  \let\sotu@oldendbib\endthebibliography
  \renewcommand{\thebibliography}[1]{%
    \begingroup
    \def\@mkboth##1##2{\markright{\bibname}}%
    \sotu@oldbib{#1}%
  }
  \renewcommand{\endthebibliography}{%
    \sotu@oldendbib
    \endgroup
  }
  % Insert a top-level "Appendix" entry into the Table of Contents
  % the moment \appendix is called, so it appears above the
  % individual "Appendix A", "Appendix B", ... chapter entries
  % that LaTeX already adds automatically via \chapter.
  \let\sotu@oldappendix\appendix
  \renewcommand{\appendix}{%
    \sotu@oldappendix
    \addcontentsline{toc}{chapter}{Appendix}%
  }
}

\endinput